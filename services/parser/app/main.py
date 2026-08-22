from __future__ import annotations

import asyncio
import os
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Annotated

from docling.document_converter import DocumentConverter
from fastapi import File, Header, HTTPException, UploadFile, FastAPI
from pydantic import BaseModel


APP_VERSION = "0.1.0"
SUPPORTED_SUFFIXES = {
    ".pdf", ".docx", ".xlsx", ".pptx", ".doc", ".xls", ".ppt",
    ".odt", ".ods", ".odp", ".html", ".htm", ".md", ".txt",
    ".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp",
}
MAX_FILE_BYTES = int(os.getenv("PARSER_MAX_FILE_MB", "25")) * 1024 * 1024

app = FastAPI(title="OBELIKS Parser", version=APP_VERSION)


def _require_service_token(authorization: Annotated[str | None, Header()] = None) -> None:
    expected = os.getenv("PARSER_SERVICE_TOKEN")
    if expected and authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Invalid parser service token.")


class ParsedDocument(BaseModel):
    filename: str
    markdown: str
    characters: int


class ParseResponse(BaseModel):
    parser_version: str
    source_filename: str
    documents: list[ParsedDocument]
    merged_markdown: str
    warnings: list[str]


def _safe_archive_members(archive: zipfile.ZipFile, target: Path) -> list[Path]:
    extracted: list[Path] = []
    total_uncompressed = 0
    target_resolved = target.resolve()

    for member in archive.infolist():
        if member.is_dir():
            continue

        total_uncompressed += member.file_size
        if total_uncompressed > MAX_FILE_BYTES * 4:
            raise ValueError("Archive expands beyond the configured safety limit.")

        destination = (target / member.filename).resolve()
        if target_resolved != destination and target_resolved not in destination.parents:
            raise ValueError("Archive contains an unsafe path.")
        if destination.suffix.lower() not in SUPPORTED_SUFFIXES:
            continue

        destination.parent.mkdir(parents=True, exist_ok=True)
        with archive.open(member) as source, destination.open("wb") as output:
            shutil.copyfileobj(source, output)
        extracted.append(destination)

    return extracted


def _convert_files(paths: list[Path], source_filename: str) -> ParseResponse:
    converter = DocumentConverter()
    documents: list[ParsedDocument] = []
    warnings: list[str] = []

    for path in paths:
        try:
            result = converter.convert(path)
            markdown = result.document.export_to_markdown()
            documents.append(
                ParsedDocument(filename=path.name, markdown=markdown, characters=len(markdown))
            )
        except Exception as exc:  # Docling exposes format-specific conversion errors.
            warnings.append(f"{path.name}: {type(exc).__name__}: {exc}")

    if not documents:
        raise ValueError("No supported document could be parsed.")

    merged = "\n\n".join(
        f"<!-- source: {document.filename} -->\n{document.markdown}" for document in documents
    )
    return ParseResponse(
        parser_version=APP_VERSION,
        source_filename=source_filename,
        documents=documents,
        merged_markdown=merged,
        warnings=warnings,
    )


def _parse_saved_upload(path: Path, original_filename: str) -> ParseResponse:
    with tempfile.TemporaryDirectory(prefix="obeliks-unpack-") as unpack_dir:
        if path.suffix.lower() == ".zip":
            try:
                with zipfile.ZipFile(path) as archive:
                    paths = _safe_archive_members(archive, Path(unpack_dir))
            except zipfile.BadZipFile as exc:
                raise ValueError("The uploaded ZIP is invalid.") from exc
        elif path.suffix.lower() in SUPPORTED_SUFFIXES:
            paths = [path]
        else:
            raise ValueError("Unsupported file format.")

        return _convert_files(paths, original_filename)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": APP_VERSION}


@app.post("/parse", response_model=ParseResponse)
async def parse_document(
    file: UploadFile = File(...),
    authorization: Annotated[str | None, Header()] = None,
) -> ParseResponse:
    _require_service_token(authorization)
    original_filename = Path(file.filename or "document").name
    suffix = Path(original_filename).suffix.lower()
    if suffix != ".zip" and suffix not in SUPPORTED_SUFFIXES:
        raise HTTPException(status_code=415, detail="Unsupported file format.")

    temporary_path: Path | None = None
    written = 0
    try:
        with tempfile.NamedTemporaryFile(prefix="obeliks-", suffix=suffix, delete=False) as temporary:
            temporary_path = Path(temporary.name)
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > MAX_FILE_BYTES:
                    raise HTTPException(status_code=413, detail="File exceeds the configured limit.")
                temporary.write(chunk)

        return await asyncio.to_thread(_parse_saved_upload, temporary_path, original_filename)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        await file.close()
        if temporary_path:
            temporary_path.unlink(missing_ok=True)
