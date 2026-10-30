begin;
create table public.signup_document_versions (
 kind text not null check (kind in ('terms','account_collection')),
 version text not null,
 document_locale text not null check (document_locale in ('ko','en')),
 snapshot text not null,
 sha256 text generated always as (encode(extensions.digest(snapshot,'sha256'),'hex')) stored,
 is_current boolean not null default true,
 status text not null default 'draft' check (status in ('draft','published')),
 primary key(kind,version)
);
create unique index signup_document_current on public.signup_document_versions(kind) where is_current;
create table public.signup_agreements (
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null,
 version text not null,
 interface_locale text not null check(interface_locale in ('ko','en')),
 accepted_at timestamptz not null default clock_timestamp(),
 primary key(user_id,kind,version),
 foreign key(kind,version) references public.signup_document_versions(kind,version)
);
alter table public.signup_document_versions enable row level security;
alter table public.signup_agreements enable row level security;
revoke all on public.signup_document_versions,public.signup_agreements from anon,authenticated,service_role;
grant select on public.signup_document_versions to anon,authenticated,service_role;
grant select on public.signup_agreements to authenticated,service_role;
grant delete on public.signup_agreements to service_role;
create policy signup_document_read on public.signup_document_versions for select to anon,authenticated using(true);
create policy signup_agreement_read on public.signup_agreements for select to authenticated using(user_id=auth.uid() and public.account_active());
insert into public.signup_document_versions(kind,version,document_locale,snapshot) values ('terms','signup-2026-10-30-draft.1','ko',$signup_snapshot$# 포둥 서비스 이용약관

버전 0.1 · 작성일 2026-10-29 · **검토용 초안 / 미시행**
시행일: [게시 전 확정: YYYY-MM-DD]

## 제1조 목적과 운영자

이 약관은 개인 **정경철**(이하 ‘운영자’)이 제공하는 포둥(podoong) 서비스의 이용 조건, 이용자와 운영자의 권리·의무를 정합니다. 운영자는 현재 법인 또는 개인사업자가 아닌 개인입니다. 문의는 **jgcman3@gmail.com**으로 접수합니다.

## 제2조 서비스와 이용자

포둥은 아이의 돌봄·성장 기록, 가족 공동 돌봄, 일정·할 일, 기록 분석·육아 가이드, 성장일기와 공개·링크 공유, 지역 기반 동네 생활을 제공합니다. 실제 제공 범위는 화면과 안내에 따릅니다. 현재 무료 기능을 유료화하거나 광고·결제 등 새로운 처리를 도입할 때에는 적용 전에 조건과 필요한 동의를 별도로 안내합니다.

이용자는 아이의 법정대리인 또는 그에게 적법하게 돌봄·기록 권한을 위임받은 보호자여야 합니다. 만 14세 미만 아동 본인의 직접 회원가입을 대상으로 하지 않습니다. 계정 명의자의 나이와 무관하게 아이 개인정보 처리에 필요한 대리권과 동의는 별도로 확인합니다.

## 제3조 가입과 계정

이용자는 지원하는 소셜 계정으로 가입·로그인하고 필요한 약관 동의와 정보 입력을 진행합니다. 소셜 계정 연결 정보 및 서비스 내부 식별자로 계정을 구분하며 이메일을 아이나 가족의 유일한 식별자로 사용하지 않습니다. 소셜 계정의 비밀번호는 해당 제공자에서 관리합니다.

이용자는 계정과 초대 링크를 안전하게 관리하고 타인의 계정·아이 정보를 무단으로 등록하지 않아야 합니다. 타인의 계정 사용이나 정보 침해가 의심되면 운영자에게 알려주세요. 이용자에게 모든 사고 책임을 전가하거나 운영자의 법적 책임을 면제하는 조항으로 해석하지 않습니다.

## 제4조 가족관리자와 보호자

가족관리자는 아이 추가·정보 변경, 주소, 보호자 초대·권한 회수, 가족관리자 이전 및 아이 데이터 삭제를 관리합니다. 초대한 보호자는 부여받은 조회·편집 권한 내에서 서비스를 이용합니다. 아이와의 관계 표시는 가족의 돌봄 관계이며 법정대리인 자격의 인증 표시가 아닙니다.

초대 링크를 받은 사람을 확인하고 필요한 최소 권한을 부여해야 합니다. 가족관리자 변경 및 보호자 권한 회수는 가족 구성원과 아이의 권리를 침해하는 수단으로 사용해서는 안 됩니다. 가족 간 대리권·기록 접근 분쟁은 관계 자료를 확인하여 법령과 아이의 권익에 맞게 처리합니다.

## 제5조 기록과 의료 정보

이용자는 입력한 기록의 정확성과 공개 범위를 확인합니다. 분석·성장곡선·마일스톤·가이드와 알림은 육아 기록을 돕기 위한 참고 정보이며 의료인의 진단·치료·응급 대응을 대신하지 않습니다. 기록 누락·입력값·기준 자료에 따라 결과가 달라질 수 있습니다.

알림 전달은 기기·브라우저·네트워크 상태의 영향을 받을 수 있습니다. 운영자는 서비스의 안전과 안정성 확보를 위해 필요한 조치를 수행하며, 이러한 제한만으로 법령상 책임을 일괄 배제하지 않습니다.

## 제6조 성장일기·사진과 공개 범위

이용자가 작성·업로드한 글과 사진의 권리는 원권리자에게 있습니다. 이용자는 서비스 보관·표시, 화면 크기별 이미지 생성, 선택한 공개·공유 범위 제공에 필요한 비독점적 이용만 허용합니다. 운영자의 독립적인 광고 소재 판매나 AI 학습에 이용할 권리를 이 약관만으로 부여하지 않습니다.

가족 내부 기록, 성장일기 공개, 링크를 가진 사람에 대한 공유는 서로 다른 범위입니다. 공개를 선택하면 아이 이름/닉네임, 성별, 생후 일수, 글·사진 및 해당 공개 탭의 성장 수치가 노출될 수 있습니다. 날짜·생후 일수 등을 조합하면 생일을 추정할 수 있습니다.

아이별 공유 링크에는 현재 및 앞으로 공개하는 일기가 함께 나타납니다. 링크가 전달되면 로그인하지 않은 사람도 볼 수 있으므로 전달 범위를 신중히 정해야 합니다. 비공개 전환·삭제·링크 종료는 이후 조회에 반영되며 이미 받은 사람의 저장·촬영·재전송 사본을 원격 회수할 수는 없습니다. 사진의 우클릭 제한 등은 저장 방지의 보장이 아닙니다.

타인의 아이·얼굴·주소·건강정보가 포함된 자료는 권한과 필요한 동의 없이 게시하지 않아야 합니다. 서비스 이용에 필요한 동의와 공개·제공 동의는 [동의 안내](consent-notices.ko.md)에 따라 구분합니다.

## 제7조 동네 생활과 거래

지역은 이용자가 설정한 주소로 정하며 정확한 실거주 인증을 보증하지 않습니다. 공동 등록한 해외 행정구역 이름은 다른 이용자의 선택 목록에 나타날 수 있습니다. 집 번지·동호수 등 상세 주거정보를 지역 이름으로 입력해서는 안 됩니다.

우리 동네 신청은 가족당 한 번 집계되며 같은 국가·시군구, 해외는 국가·시도·시군구에 10가족이 신청하면 세 영역이 함께 열립니다. 지역 변경 시 새 지역의 신청 및 제공 조건이 적용됩니다.

커뮤니티·나눔·중고거래·지원 정보에는 [동네 생활 운영정책](community-policy.ko.md)을 적용합니다. 현재 거래 게시 공간은 결제·에스크로·배송·판매자 신원 인증을 제공하지 않습니다. 지원 정보는 게시자의 정보이며 실제 자격·신청기간은 담당 기관에서 확인해야 합니다. 향후 운영자의 판매·거래 관여 범위가 달라지면 관련 조건을 사전에 정합니다.

## 제8조 금지행위와 조치

사칭, 무단 정보 수집, 타인의 아동·사진·건강정보 침해, 불법 거래·사기, 권리 침해, 혐오·위협·괴롭힘, 스팸, 계정·가족을 조작한 중복 신청, 서비스 보안 침해를 금지합니다.

위반 정도와 긴급성에 따라 게시물 제한·삭제, 기능 제한·계정 이용 정지를 할 수 있습니다. 원칙적으로 사유와 이의제기 방법을 안내하되 즉시 보호가 필요한 경우 우선 조치 후 안내할 수 있습니다. 이용자는 문의 이메일로 소명·이의제기를 할 수 있습니다. 정당한 비판이나 민원을 이유로 임의 제재하지 않습니다.

## 제9조 탈퇴·삭제와 관리자 이전

**가족관리자가 탈퇴하려면 관리하는 각 가족에서 본인 외 보호자가 없어야 합니다.** 다른 보호자가 있으면 가족관리자를 이전하거나 해당 보호자의 권한을 회수해야 합니다.

**본인만 남은 가족관리자가 탈퇴하면 관리하는 가족과 모든 아이의 모든 서비스 데이터가 삭제 대상이 됩니다.** 여기에는 기록·일정·사진 원본과 표시용 이미지·공유 일기장 등이 포함됩니다. 관리자 이전으로 보존할 가족은 탈퇴 전에 이전해야 합니다. 다른 보호자의 계정은 해당 탈퇴만으로 삭제되지 않습니다.

가족관리자는 데이터 설정에서 아이별 영구 삭제를 요청할 수 있습니다. 일반 보호자가 탈퇴하면 본인 계정·접근 권한을 정리하고, 다른 가족이 보유할 권한이 있는 공동 기록은 작성자 식별 정보를 제거한 상태로 남을 수 있습니다. 상세한 범위와 예외는 처리방침에 따릅니다.

화면에서 접근이 차단된 후에도 Storage·인증 계정 삭제 작업은 순차 완료될 수 있습니다. 실패 시 재시도하며 처리에 문제가 있으면 문의 창구로 접수할 수 있습니다. 법정 보존 또는 실제 백업 잔존은 별도 근거·기간에 따라 관리하며 삭제 자료를 일반 서비스 용도로 재사용하지 않습니다.

## 제10조 변경·중단과 책임

운영자는 점검·보안·기술적 필요로 서비스를 변경하거나 일시 중단할 수 있고 가능한 범위에서 사전 안내합니다. 장기 중단·종료 시 일정, 이용자가 기록을 확보할 방법 및 삭제 일정을 별도로 안내합니다.

당사자의 고의·과실과 손해배상 책임은 관계법령에 따릅니다. 개인 운영·무료 서비스라는 사유만으로 운영자의 고의·중과실이나 법령상 의무를 면제하지 않습니다. 이용자의 게시물·거래에 관한 분쟁도 운영자의 실제 관여와 법적 의무에 맞춰 처리합니다.

## 제11조 약관 변경과 분쟁

약관을 변경하면 변경 내용·이유·시행일을 사전에 알리고, 이용자에게 불리하거나 중요한 변경은 충분한 검토 시간을 두고 개별 안내하며 필요한 동의를 받습니다. 침묵이나 계속 이용만으로 모든 변경에 일괄 동의한 것으로 간주하지 않습니다. 동의하지 않는 이용자의 탈퇴·기록 처리 방법을 함께 안내합니다.

대한민국 법령을 기준으로 작성하였으며 강행법규에 따른 이용자의 권리를 제한하지 않습니다. 분쟁은 우선 문의 창구를 통해 해결을 시도하고 소송 관할은 관계법령에 따릅니다. 해외 이용에 적용되는 강행 규정도 배제하지 않습니다.
$signup_snapshot$);
insert into public.signup_document_versions(kind,version,document_locale,snapshot) values ('account_collection','signup-2026-10-30-draft.1','ko',$signup_snapshot$# 가입 개인정보 수집·이용 안내

버전 0.1 · 작성일 2026-10-30 · **개발 테스트용 초안 / 정식 서비스 미시행**

운영자: 정경철 · 문의 및 동의 철회: jgcman3@gmail.com

## 수집·이용 목적

소셜 계정으로 회원을 식별하고, 보호자 프로필 및 가족의 접근 권한을 관리합니다. 선택한 언어와 시간대를 적용하고 이용약관·가입 동의 이력을 관리합니다.

## 수집 항목

소셜 제공자와 제공자별 계정 식별자, 서비스 내부 계정 ID, 소셜 기본 프로필(닉네임·프로필 이미지 주소 등 실제 제공된 항목), 보호자 표시 이름, 언어·시간대, 가족 연결 정보와 아이와의 관계, 동의한 문서의 버전·해시·언어 및 동의 시각입니다. 이메일은 소셜 제공자가 제공한 경우에만 처리하며 필수 가입 항목이 아닙니다. 소셜 계정의 비밀번호는 수집하지 않습니다.

## 보유 및 이용기간

회원 탈퇴 또는 해당 처리 목적 달성 시까지 보관하며, 계정 삭제 절차에 따라 삭제합니다. 가입 동의 이력은 계정 삭제 시 함께 삭제 대상으로 연결됩니다. 백업·법적 보존 예외 등의 정식 운영 정책은 개인정보 처리방침을 확정하면서 별도로 안내합니다.

## 거부할 권리와 영향

수집·이용 동의를 거부할 수 있습니다. 가입에 필요한 위 항목의 처리에 동의하지 않으면 보호자 계정과 가족 기록 서비스를 시작할 수 없습니다.

## 이 동의에 포함되지 않는 내용

아이 기본정보의 처리 권한·법정대리인 확인, 건강정보의 별도 처리, 성장일기·사진의 외부 공개 및 링크 공유, 마케팅, 광고 추적, AI 전송을 이 가입 동의로 대신하지 않습니다.

## 개발 단계 안내

현재 화면은 가입 절차를 검증하는 개발 테스트용입니다. 실제 아동 개인정보·건강정보·사진을 입력하지 마세요. 이 초안의 확인 이력을 정식 서비스 약관에 대한 동의나 법정대리인 확인 완료로 소급하지 않습니다. 정식 공개 전에는 문서 확정과 필요한 별도 절차가 남아 있습니다.
$signup_snapshot$);

create function public.has_signup_agreement() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.account_active()
 and (select count(*) from public.signup_document_versions where is_current)=2
 and not exists(select 1 from public.signup_document_versions d where d.is_current
 and not exists(select 1 from public.signup_agreements a where a.user_id=auth.uid() and a.kind=d.kind and a.version=d.version));
$$;
create function public.accept_signup_agreements(p_locale text,p_terms_version text,p_collection_version text,p_terms boolean,p_collection boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.account_active() then raise exception 'forbidden' using errcode='42501'; end if;
 if p_locale is null or p_locale not in ('ko','en') or p_terms is distinct from true or p_collection is distinct from true
 or not exists(select 1 from public.signup_document_versions where kind='terms' and version=p_terms_version and is_current)
 or not exists(select 1 from public.signup_document_versions where kind='account_collection' and version=p_collection_version and is_current)
 then raise exception 'agreement_required' using errcode='22023'; end if;
 insert into public.signup_agreements(user_id,kind,version,interface_locale)
 values(auth.uid(),'terms',p_terms_version,p_locale),(auth.uid(),'account_collection',p_collection_version,p_locale)
 on conflict(user_id,kind,version) do nothing;
end $$;
-- Existing timestamps are legacy acknowledgments, never backfilled as versioned agreements.
-- Administrative imports remain possible; new browser-created consents require both documents.
create function public.require_signup_agreement_for_profile() returns trigger
language plpgsql set search_path='' as $$
begin
 if current_user='authenticated' and new.consented_at is not null
 and (tg_op='INSERT' or old.consented_at is null)
 and not public.has_signup_agreement() then
 raise exception 'agreement_required' using errcode='42501';
 end if;
 return new;
end $$;
create trigger profile_signup_agreement before insert or update on public.profiles
for each row execute function public.require_signup_agreement_for_profile();
revoke all on function public.has_signup_agreement(),public.accept_signup_agreements(text,text,text,boolean,boolean),public.require_signup_agreement_for_profile() from public,anon,authenticated;
grant execute on function public.has_signup_agreement(),public.accept_signup_agreements(text,text,text,boolean,boolean) to authenticated;
commit;
