-- Editorial drafts are not visible to users until reviewed and published.
insert into public.content_items(key,service,source_url,status) values
('birth-registration','administration','https://www.gov.kr/','draft'),
('family-benefits','support','https://www.bokjiro.go.kr/','draft'),
('vaccination','vaccination','https://nip.kdca.go.kr/','draft') on conflict do nothing;
insert into public.content_translations(content_key,locale,title,body) values
('birth-registration','ko','출생 후 행정 안내','공식 안내의 적용 조건·서류·기한을 검토한 후 게시합니다.'),
('birth-registration','en','Birth administration','Publish after reviewing official requirements, documents and deadlines.'),
('family-benefits','ko','정부·지역 지원','지역별 지원 후보와 공식 조건을 검토한 후 게시합니다.'),
('family-benefits','en','Government and local support','Publish after reviewing regional programs and official eligibility.'),
('vaccination','ko','예방접종','공식 안내와 번역을 검토한 후 게시합니다.'),
('vaccination','en','Vaccination','Publish after official guidance and translations are reviewed.') on conflict do nothing;
