-- Rehydrate the clean MVP with source-backed Informatika UNDIP data.
-- Source snapshot committed in this repository: data/if-undip/public-snapshot.json
-- Snapshot date: 2026-08-23. Course catalog: 2024 OBE. Graduate outcomes are
-- retained exactly from the published CPL snapshot. Course↔CPL and CPMK mappings
-- are deliberately NOT invented because the snapshot marks them not_published.
--
-- No auth user is created here. RPS draft ownership is bound to an existing,
-- active auth/profile identity so Manajemen Pengguna continues to show real accounts.

do $$
declare
  v_org uuid;
  v_program uuid;
  v_curriculum uuid;
  v_active_period uuid;
  v_actor uuid;
begin
  select id into v_org from public.organizations where slug = 'informatika-undip';
  if v_org is null then
    raise exception 'if_undip_seed_requires_informatika_undip_organization';
  end if;

  select p.id into v_actor
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.platform_roles pr on pr.user_id = p.id
  where p.status = 'active'
  order by case when pr.role = 'superadmin' then 1 else 0 end, u.created_at
  limit 1;
  if v_actor is null then
    select id into v_actor from auth.users order by created_at limit 1;
  end if;
  if v_actor is null then
    raise exception 'if_undip_seed_requires_existing_auth_user';
  end if;

  insert into public.academic_programs (
    organization_id, university_name, faculty_name, department_name, program_name, program_code, is_enabled
  ) values (
    v_org, 'Universitas Diponegoro', 'Fakultas Sains dan Matematika', 'Departemen Informatika', 'S-1 Informatika', 'S1-INF', true
  )
  on conflict (organization_id) do update set
    university_name = excluded.university_name,
    faculty_name = excluded.faculty_name,
    department_name = excluded.department_name,
    program_name = excluded.program_name,
    program_code = excluded.program_code,
    is_enabled = true,
    updated_at = now()
  returning id into v_program;

  insert into public.curricula (academic_program_id, code, name, start_year, status, notes)
  values (
    v_program,
    'IF-2024-OBE',
    'Kurikulum 2024 OBE',
    2024,
    'active',
    'Katalog mata kuliah berasal dari snapshot publik if.undip.ac.id per 2026-08-23. CPL bersumber dari halaman CPL yang pada sumber menyatakan kurikulum 2022; tidak dilakukan inferensi mapping lintas versi.'
  )
  on conflict (academic_program_id, code) do update set
    name = excluded.name,
    start_year = excluded.start_year,
    status = 'active',
    notes = excluded.notes,
    updated_at = now()
  returning id into v_curriculum;

  insert into public.program_learning_outcomes (curriculum_id, code, description, sort_order)
  values
    (v_curriculum,'CPL-01','Mampu menerapkan dan menunjukkan tanggung jawab profesional berdasarkan nilai ketakwaan kepada Tuhan Yang Maha Esa dan nilai kemanusiaan.',1),
    (v_curriculum,'CPL-02','Mampu menerapkan dan menunjukkan nilai, norma, etika akademik, prinsip keberagaman pendapat dan budaya, serta kepedulian sosial dalam berkolaborasi.',2),
    (v_curriculum,'CPL-03','Mampu melaksanakan prinsip nasionalisme, taat hukum, dan menunjukkan sikap disiplin dalam memajukan kehidupan bermasyarakat dan bernegara berdasarkan Pancasila.',3),
    (v_curriculum,'CPL-04','Mampu menerapkan prinsip kemandirian dan kewirausahaan dalam bidang informatika serta melakukan evaluasi secara bermutu dan terukur.',4),
    (v_curriculum,'CPL-05','Mampu menerapkan konsep teoretis bidang ilmu komputer dalam mengidentifikasi solusi permasalahan kompleks dengan prinsip komputasi dan ilmu lain yang relevan.',5),
    (v_curriculum,'CPL-06','Mampu menerapkan pemikiran analitis berbasis data untuk memformulasikan penyelesaian permasalahan kompleks untuk suatu organisasi.',6),
    (v_curriculum,'CPL-07','Mampu menerapkan konsep sistem dan pengembangan perangkat lunak untuk menghasilkan solusi atas permasalahan kompleks di berbagai bidang dengan mempertimbangkan aspek keamanan.',7),
    (v_curriculum,'CPL-08','Mampu menerapkan pemikiran logis, kritis, sistematis, dan inovatif dalam mengkaji implikasi pengembangan hasil riset bidang Informatika terkini sebagai educator pembelajar sepanjang hayat.',8),
    (v_curriculum,'CPL-09','Mampu membangun dan mempraktekan komunikasi secara efektif, bekerja sama dan kolaborasi, dan menerapkan nilai kepemimpinan.',9),
    (v_curriculum,'CPL-10','Mampu menghasilkan rancangan, mengimplementasikan, dan mengevaluasi solusi berbasis algoritma dengan mempertimbangkan aspek kompleksitas.',10),
    (v_curriculum,'CPL-11','Mampu menghasilkan rancangan, mengimplementasikan, dan mengevaluasi solusi berbasis komputasi cerdas.',11),
    (v_curriculum,'CPL-12','Mampu menghasilkan rancangan dan mengimplementasikan solusi manajemen informasi dengan pendekatan data analytics.',12)
  on conflict (curriculum_id, code) do update set description = excluded.description, sort_order = excluded.sort_order, updated_at = now();

  -- Complete 83-code catalog from the committed public snapshot.
  create temporary table if not exists if_undip_course_seed (
    code text primary key,
    name text not null,
    credits numeric(4,1) not null,
    semester smallint,
    requirement text not null,
    term text
  ) on commit drop;
  truncate if_undip_course_seed;
  insert into if_undip_course_seed (code,name,credits,semester,requirement,term) values
    ('MIK1624101','Dasar Sistem',3,1,'required',null),
    ('MIK1624102','Dasar Pemrograman',3,1,'required',null),
    ('MIK1624103','Struktur Diskret',4,1,'required',null),
    ('MIK1624104','Matematika I',2,1,'required',null),
    ('MIK1624105','Aljabar Linier',3,1,'required',null),
    ('UUW1624002','Pancasila',2,1,'required',null),
    ('UUW1624107','Bahasa Inggris I',1,1,'required',null),
    ('UUW1624004','Bahasa Indonesia',2,1,'required',null),
    ('MIK1624201','Organisasi dan Arsitektur Komputer',3,2,'required',null),
    ('MIK1624202','Algoritma dan Pemrograman',4,2,'required',null),
    ('MIK1624203','Statistika',2,2,'required',null),
    ('MIK1624204','Matematika II',2,2,'required',null),
    ('MIK1624205','Metode Numerik',3,2,'required',null),
    ('UUW1624003','Kewarganegaraan',2,2,'required',null),
    ('UUW1624207','Bahasa Inggris II',1,2,'required',null),
    ('UUW1624005','Olah Raga',1,2,'required',null),
    ('UUW1624011','Pendidikan Agama Islam',2,2,'required',null),
    ('UUW1624021','Pendidikan Agama Kristen',2,2,'required',null),
    ('UUW1624031','Pendidikan Agama Katolik',2,2,'required',null),
    ('UUW1624041','Pendidikan Agama Hindu',2,2,'required',null),
    ('UUW1624051','Pendidikan Agama Budha',2,2,'required',null),
    ('UUW1624061','Pendidikan Agama Kong Hu Chu',2,2,'required',null),
    ('UUW1624071','Kepercayaan Kepada Tuhan YME',2,2,'required',null),
    ('MIK1624301','Sistem Operasi',3,3,'required',null),
    ('MIK1624302','Struktur Data',4,3,'required',null),
    ('MIK1624303','Basis Data',4,3,'required',null),
    ('MIK1624304','Rekayasa Perangkat Lunak',3,3,'required',null),
    ('MIK1624305','Teori Bahasa dan Otomata',3,3,'required',null),
    ('UUW1624307','Bahasa Inggris III',1,3,'required',null),
    ('MIK1624402','Pemrograman Berorientasi Objek',3,4,'required',null),
    ('MIK1624403','Manajemen Basis Data',3,4,'required',null),
    ('MIK1624406','Grafik dan Teknik Interaktif',3,4,'required',null),
    ('MIK1624405','Kecerdasan Buatan',3,4,'required',null),
    ('MIK1624404','Analisis dan Strategi Algoritma',3,4,'required',null),
    ('MIK1624401','Jaringan Komputer',3,4,'required',null),
    ('MIK1624501','Komputasi Tersebar dan Paralel',3,5,'required',null),
    ('MIK1624502','Pengembangan Platform Khusus',4,5,'required',null),
    ('MIK1624503','Sistem Informasi',3,5,'required',null),
    ('MIK1624504','Proyek Perangkat Lunak',3,5,'required',null),
    ('MIK1624505','Pembelajaran Mesin',3,5,'required',null),
    ('MIK1624506','Probabilitas Diskret',2,5,'required',null),
    ('MIK1624601','Keamanan dan Jaminan Informasi',3,6,'required',null),
    ('MIK1624602','Uji Perangkat Lunak',3,6,'required',null),
    ('MIK1624603','Interaksi Manusia Komputer',3,6,'required',null),
    ('MIK1624604','Manajemen Proyek',3,6,'required',null),
    ('MIK1624605','Analitika Data',3,6,'required',null),
    ('MIK1624606','Praktik Kerja Lapangan',3,6,'required',null),
    ('MIK1624701','Metodologi dan Penulisan Ilmiah',2,7,'required',null),
    ('MIK1624702','Masyarakat dan Etika Profesi',2,7,'required',null),
    ('UUW1624006','Internet of Things',2,7,'required',null),
    ('UUW1624008','Kewirausahaan',2,7,'required',null),
    ('UUW1624009','Kuliah Kerja Nyata',3,7,'required',null),
    ('MIK1624899','Tugas Akhir',6,8,'required',null),
    ('MIK1624703','Topik Khusus Rekayasa Perangkat Lunak, Sistem dan Teknologi Informasi',3,null,'elective','odd'),
    ('MIK1624704','Topik Khusus Kecerdasan Buatan, Komputasi dan Grafik',3,null,'elective','odd'),
    ('MIK1624711','Metode Perangkat Lunak',3,null,'elective','odd'),
    ('MIK1624712','Kualitas Perangkat Lunak',3,null,'elective','odd'),
    ('MIK1624713','Visualisasi Data',3,null,'elective','odd'),
    ('MIK1624714','Penambangan Data',3,null,'elective','odd'),
    ('MIK1624715','Sistem Tertanam',3,null,'elective','odd'),
    ('MIK1624721','Pemodelan dan Simulasi',3,null,'elective','odd'),
    ('MIK1624722','Visi Komputer',3,null,'elective','odd'),
    ('MIK1624723','Algoritma Evolusioner',3,null,'elective','odd'),
    ('MIK1624724','Komputasi Lunak',3,null,'elective','odd'),
    ('MIK1624725','Temu Balik Informasi',3,null,'elective','odd'),
    ('MIK1624811','Evolusi Perangkat Lunak',3,null,'elective','even'),
    ('MIK1624812','Rekayasa Sistem',3,null,'elective','even'),
    ('MIK1624813','Komputasi Awan',3,null,'elective','even'),
    ('MIK1624814','Arsitektur Perangkat Lunak',3,null,'elective','even'),
    ('MIK1624815','Pemrograman Lanjut',3,null,'elective','even'),
    ('MIK1624816','Data Besar',3,null,'elective','even'),
    ('MIK1624817','Intelijen Bisnis',3,null,'elective','even'),
    ('MIK1624818','Rekayasa Data',3,null,'elective','even'),
    ('MIK1624819','Sistem Enterprise',3,null,'elective','even'),
    ('MIK1624821','Pengenalan Pola',3,null,'elective','even'),
    ('MIK1624822','Kriptografi',3,null,'elective','even'),
    ('MIK1624823','Bioinformatika',3,null,'elective','even'),
    ('MIK1624824','Keamanan Siber',3,null,'elective','even'),
    ('MIK1624825','Forensik Digital',3,null,'elective','even'),
    ('MIK1624826','Robotika',3,null,'elective','even'),
    ('MIK1624827','Penambangan Data',3,null,'elective','even'),
    ('MIK1624828','Analisis Jaringan Sosial',3,null,'elective','even'),
    ('MIK1624829','Sains Data',3,null,'elective','even');

  if (select count(*) from if_undip_course_seed) <> 83 then
    raise exception 'if_undip_seed_expected_83_course_codes';
  end if;

  insert into public.courses (organization_id, code, name, credits, semester, metadata)
  select v_org, code, name, credits, semester,
    jsonb_build_object('source','if-undip-public-snapshot','curriculum','2024 OBE','requirement',requirement,'term',term)
  from if_undip_course_seed
  on conflict (organization_id, code) do update set
    name = excluded.name, credits = excluded.credits, semester = excluded.semester, metadata = excluded.metadata, updated_at = now();

  insert into public.curriculum_courses (
    curriculum_id, legacy_course_id, code, name, credits, recommended_semester, description, is_available_for_reoffer
  )
  select v_curriculum, legacy.id, source.code, source.name, source.credits, source.semester,
    case when source.requirement = 'elective' then 'Mata kuliah pilihan; term publik: ' || source.term else null end,
    true
  from if_undip_course_seed source
  left join public.courses legacy on legacy.organization_id = v_org and legacy.code = source.code
  on conflict (curriculum_id, code) do update set
    legacy_course_id = excluded.legacy_course_id,
    name = excluded.name,
    credits = excluded.credits,
    recommended_semester = excluded.recommended_semester,
    description = excluded.description,
    is_available_for_reoffer = true,
    updated_at = now();

  insert into public.academic_periods (
    academic_program_id, primary_curriculum_id, label, term, academic_year, starts_at, ends_at, status, created_by
  ) values
    (v_program,v_curriculum,'Genap 2025/2026','Genap','2025/2026',date '2026-02-02',date '2026-06-13','closed',v_actor),
    (v_program,v_curriculum,'Gasal 2026/2027','Gasal','2026/2027',date '2026-08-17',date '2026-12-19','active',v_actor),
    (v_program,v_curriculum,'Genap 2026/2027','Genap','2026/2027',date '2027-02-01',date '2027-06-12','draft',v_actor)
  on conflict (academic_program_id, label) do update set
    primary_curriculum_id = excluded.primary_curriculum_id,
    term = excluded.term,
    academic_year = excluded.academic_year,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    status = excluded.status,
    updated_at = now();

  select id into v_active_period from public.academic_periods where academic_program_id = v_program and status = 'active';

  insert into public.academic_stages (academic_period_id, stage_key, title, starts_at, ends_at, access_roles, sort_order)
  values
    (v_active_period,'assignment','Penugasan pengajaran',date '2026-07-20',date '2026-08-03',array['admin','kaprodi']::text[],1),
    (v_active_period,'rps-authoring','Penyusunan RPS',date '2026-08-01',date '2026-08-20',array['admin','dosen']::text[],2),
    (v_active_period,'gpm-review','Review GPM',date '2026-08-10',date '2026-08-25',array['admin','gpm']::text[],3),
    (v_active_period,'head-approval','Pengesahan Kaprodi',date '2026-08-18',date '2026-08-29',array['admin','kaprodi']::text[],4),
    (v_active_period,'teaching','Pelaksanaan pengajaran',date '2026-08-17',date '2026-12-05',array['admin','dosen','mahasiswa']::text[],5),
    (v_active_period,'evaluation','Evaluasi & tindak lanjut',date '2026-12-07',date '2026-12-23',array['admin','kaprodi','gpm','dosen']::text[],6)
  on conflict (academic_period_id, stage_key) do update set title = excluded.title, starts_at = excluded.starts_at, ends_at = excluded.ends_at, access_roles = excluded.access_roles, sort_order = excluded.sort_order, updated_at = now();

  -- Source-backed starter RPS rows. Only identity and the PROGRAM CPL CATALOG are
  -- prefilled. No CPL is assigned to a course and no CPMK is invented here.
  insert into public.rps_documents (
    organization_id, curriculum_course_id, academic_period_id, created_by, academic_year,
    version, status, source_path, source_checksum, structured_data, validation_summary
  )
  select
    v_org,
    cc.id,
    v_active_period,
    v_actor,
    '2026/2027',
    1,
    'draft',
    'seed://if-undip-public-snapshot/' || cc.code,
    'if-undip-2024-obe-' || cc.code || '-2026-08-23',
    jsonb_build_object(
      'schemaVersion','rps-obe-studio-1',
      'provenance',jsonb_build_object(
        'source','data/if-undip/public-snapshot.json',
        'snapshot_date','2026-08-23',
        'curriculum','2024 OBE',
        'course_cpl_mapping','not_published',
        'course_learning_outcomes','not_published'
      ),
      'meta',jsonb_build_object(
        'institution','Universitas Diponegoro',
        'faculty','Fakultas Sains dan Matematika',
        'program','S-1 Informatika',
        'courseName',cc.name,
        'code',cc.code,
        'credits',cc.credits,
        'semester',cc.recommended_semester,
        'review','Gasal 2026/2027'
      ),
      'cpl_catalog',(
        select coalesce(jsonb_agg(jsonb_build_object('id',plo.id::text,'code',plo.code,'description',plo.description,'english','') order by plo.sort_order),'[]'::jsonb)
        from public.program_learning_outcomes plo where plo.curriculum_id = v_curriculum
      ),
      'cpl','[]'::jsonb,
      'cpmk','[]'::jsonb,
      'subCpmk','[]'::jsonb,
      'curriculum_context',jsonb_build_object('program','S-1 Informatika','name','Kurikulum 2024 OBE','currentRole','I')
    ),
    jsonb_build_object(
      'schema_version','rps-obe-studio-1',
      'issue_count',2,
      'issues',jsonb_build_array(
        jsonb_build_object('severity','warning','title','CPL mata kuliah belum dipilih','detail','Katalog CPL program tersedia, tetapi mapping course↔CPL tidak dipublikasikan pada sumber.'),
        jsonb_build_object('severity','warning','title','CPMK belum disusun','detail','Gunakan editor atau Generator Contoh lalu lakukan review manual sebelum finalisasi.')
      )
    )
  from public.curriculum_courses cc
  where cc.curriculum_id = v_curriculum
    and cc.code in ('MIK1624102','MIK1624303','MIK1624404','MIK1624505','MIK1624605','UUW1624006')
  on conflict (organization_id, source_checksum) do update set
    curriculum_course_id = excluded.curriculum_course_id,
    academic_period_id = excluded.academic_period_id,
    created_by = excluded.created_by,
    structured_data = excluded.structured_data,
    validation_summary = excluded.validation_summary,
    updated_at = now();
end $$;

comment on table public.curricula is 'Curriculum master. IF-2024-OBE seed is sourced from data/if-undip/public-snapshot.json; mappings not published by the source must not be inferred.';
