module.exports=[99593,a=>{"use strict";var b=a.i(24868),c=a.i(14747);let d=c.default.join(process.cwd(),"data","therapists"),e=c.default.join(d,"registration-profiles.json");async function f(){await (0,b.mkdir)(d,{recursive:!0})}async function g(){await f();try{let a=await (0,b.readFile)(e,"utf8"),c=JSON.parse(a);return Array.isArray(c)?c:[]}catch{return[]}}function h(a){let{licenseFileDataUrl:b,...c}=a;return c}async function i(a){if(!a.length)return[];let b=new Set(a.map(a=>String(a).trim()).filter(Boolean));return(await g()).filter(a=>b.has(a.userId)).map(h)}a.s(["getTherapistRegistrationProfilesByUserIds",()=>i])},18924,a=>a.a(async(b,c)=>{try{var d=a.i(40003),e=a.i(45252),f=a.i(1383),g=a.i(27788),h=a.i(99593),i=b([d,e,g]);async function j(a){let b=await (0,d.getAuthenticatedSessionContext)(a);if(!b)throw Error("unauthorized");return b}async function k(){let a=(0,g.getDbPool)(),b=await a.query(`
      SELECT to_regclass('public.therapist_patient_assignments') IS NOT NULL AS exists
    `);return!!b.rows[0]?.exists}async function l(){let a=(0,g.getDbPool)(),b=await a.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'app_users'
          AND column_name = 'organization_id'
      ) AS exists
    `);return!!b.rows[0]?.exists}async function m(){let a=(0,g.getDbPool)(),b=await a.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'app_users'
          AND column_name = 'approval_state'
      ) AS exists
    `);return!!b.rows[0]?.exists}async function n(a){if(!await l())return null;let b=(0,g.getDbPool)(),c=await b.query(`
      SELECT organization_id::text AS organization_id
      FROM app_users
      WHERE user_id = $1
      LIMIT 1
    `,[a.userId]);return c.rows[0]?.organization_id?String(c.rows[0].organization_id):null}async function o(a){if("admin"===a.userRole)return null;if("therapist"!==a.userRole)throw Error("forbidden");if(!await k())return[];let b=(0,g.getDbPool)();return(await b.query(`
      SELECT DISTINCT patient_id::text AS patient_id
      FROM therapist_patient_assignments
      WHERE therapist_user_id = $1
        AND is_active = TRUE
      ORDER BY patient_id::text ASC
    `,[a.userId])).rows.map(a=>String(a.patient_id??"").trim()).filter(a=>a.length>0)}async function p(a,b){if("admin"===a.userRole)return;let c=await o(a);if(!c?.includes(b))throw Error("forbidden")}async function q(a){let b=await j(a);if("admin"===b.userRole)return(0,e.listAdminPatientReportSummaries)(a);let c=await o(b);if(!c?.length)return[];let d=(0,g.getDbPool)(),f=await d.connect();try{let a=await f.query(`
        SELECT
          to_regclass('public.therapist_patient_assignments') IS NOT NULL AS has_assignments,
          to_regclass('public.patient_intake_profiles')       IS NOT NULL AS has_intake,
          to_regclass('public.organizations')                 IS NOT NULL AS has_organizations
      `),b=!!a.rows[0]?.has_assignments,d=!!a.rows[0]?.has_intake,e=!!a.rows[0]?.has_organizations,g=b?`
          tpii.full_name AS therapist_name,
          tu.login_id    AS therapist_login_id,
          tu.user_id::text AS therapist_user_id,
          ${e?"torg.organization_name":"NULL::text"} AS therapist_organization_name,
      `:`
          NULL::text AS therapist_name,
          NULL::text AS therapist_login_id,
          NULL::text AS therapist_user_id,
          NULL::text AS therapist_organization_name,
      `,h=b?`
          LEFT JOIN LATERAL (
            SELECT tpa.therapist_user_id
            FROM therapist_patient_assignments tpa
            WHERE tpa.patient_id = pii.patient_id
              AND COALESCE(tpa.is_active, TRUE) = TRUE
            ORDER BY tpa.assigned_at DESC NULLS LAST
            LIMIT 1
          ) tpa ON TRUE
          LEFT JOIN app_users  tu   ON tu.user_id    = tpa.therapist_user_id
          LEFT JOIN patient_pii tpii ON tpii.patient_id = tu.patient_id
          ${e?"LEFT JOIN organizations torg ON torg.organization_id = tu.organization_id":""}
      `:"",i=d?`
          pip.education_years   AS education_years,
          pip.onset_date::text  AS onset_date,
          pip.days_since_onset  AS days_since_onset,
          pip.hemiplegia        AS hemiplegia,
          pip.hemianopsia       AS hemianopsia,
          pip.hand              AS hand,
      `:`
          NULL::int  AS education_years,
          NULL::text AS onset_date,
          NULL::int  AS days_since_onset,
          NULL::text AS hemiplegia,
          NULL::text AS hemianopsia,
          NULL::text AS hand,
      `;return(await f.query(`
        SELECT
          pii.patient_id::text AS patient_id,
          ppm.patient_pseudonym_id,
          pii.full_name,
          pii.patient_code,
          pii.birth_date::text AS birth_date,
          pii.phone,
          pii.sex,
          pii.created_at::text AS created_at,
          au.login_id,
          ${i}
          ${g}
          (
            SELECT MAX(created_at)
            FROM (
              SELECT ltr.created_at
              FROM language_training_results ltr
              WHERE ltr.patient_pseudonym_id = ppm.patient_pseudonym_id
              UNION ALL
              SELECT sr.created_at
              FROM sing_results sr
              WHERE sr.patient_pseudonym_id = ppm.patient_pseudonym_id
            ) AS activities
          )::text AS latest_activity_at,
          (
            SELECT COUNT(*)::int
            FROM language_training_results ltr
            WHERE ltr.patient_pseudonym_id = ppm.patient_pseudonym_id
              AND ltr.training_mode = 'self'
          ) AS self_assessment_count,
          (
            SELECT COUNT(*)::int
            FROM language_training_results ltr
            WHERE ltr.patient_pseudonym_id = ppm.patient_pseudonym_id
              AND ltr.training_mode = 'rehab'
          ) AS rehab_count,
          (
            SELECT COUNT(*)::int
            FROM sing_results sr
            WHERE sr.patient_pseudonym_id = ppm.patient_pseudonym_id
          ) AS sing_count
        FROM patient_pii pii
        JOIN patient_pseudonym_map ppm ON ppm.patient_id = pii.patient_id
        JOIN app_users au
          ON au.patient_id = pii.patient_id
         AND au.user_role = 'patient'
        ${d?"LEFT JOIN patient_intake_profiles pip ON pip.patient_id = pii.patient_id":""}
        ${h}
        WHERE pii.patient_id = ANY($1::uuid[])
        ORDER BY latest_activity_at DESC NULLS LAST, pii.created_at DESC
      `,[c])).rows.map(a=>{let b="string"==typeof a.sex?a.sex.trim().toUpperCase():"",c="string"==typeof a.hemiplegia?a.hemiplegia.trim().toUpperCase():"",d="string"==typeof a.hemianopsia?a.hemianopsia.trim().toUpperCase():"";return{patientId:String(a.patient_id),patientPseudonymId:String(a.patient_pseudonym_id),patientName:String(a.full_name),patientCode:String(a.patient_code),loginId:a.login_id?String(a.login_id):null,birthDate:a.birth_date?String(a.birth_date):null,phone:a.phone?String(a.phone):null,sex:"M"===b||"F"===b||"U"===b?b:null,educationYears:null==a.education_years?null:Number(a.education_years),onsetDate:a.onset_date?String(a.onset_date):null,daysSinceOnset:null==a.days_since_onset?null:Number(a.days_since_onset),hemiplegia:"Y"===c||"N"===c?c:null,hemianopsia:"LEFT"===d||"RIGHT"===d||"NONE"===d?d:null,hand:a.hand?String(a.hand):null,latestActivityAt:a.latest_activity_at?String(a.latest_activity_at):null,createdAt:a.created_at?String(a.created_at):null,selfAssessmentCount:Number(a.self_assessment_count??0),rehabCount:Number(a.rehab_count??0),singCount:Number(a.sing_count??0),therapistName:a.therapist_name?String(a.therapist_name):null,therapistLoginId:a.therapist_login_id?String(a.therapist_login_id):null,therapistUserId:a.therapist_user_id?String(a.therapist_user_id):null,therapistOrganizationName:a.therapist_organization_name?String(a.therapist_organization_name):null}})}finally{f.release()}}async function r(a){let b=await j(a);if("admin"===b.userRole)return(0,e.listAdminReportValidationSample)(a);let c=await q(a);return c.length?(await Promise.all(c.map(b=>(0,e.getAdminPatientReportDetail)(a,b.patientId)))).flatMap(a=>a.entries).sort((a,b)=>b.completedAt-a.completedAt):[]}async function s(a,b){let c=await j(a);return await p(c,b),(0,e.getAdminPatientReportDetail)(a,b)}async function t(a){let b=await j(a),c=(0,g.getDbPool)(),d=await l(),e=await m(),i=await k(),o=await (0,f.listAvailableOrganizations)(),p=new Map(o.map(a=>[a.id,a.name])),q="WHERE u.user_role = 'therapist'",r=[];if("therapist"===b.userRole){if(!d)return[];let a=await n(b);if(!a)return[];r.push(a),q+=` AND u.organization_id = $${r.length}::uuid`}let s=i?`
      LEFT JOIN therapist_patient_assignments tpa
        ON tpa.therapist_user_id = u.user_id
       AND tpa.is_active = TRUE
    `:"",t=await c.query(`
      SELECT
        u.user_id::text AS therapist_user_id,
        pii.full_name AS therapist_name,
        u.login_id,
        ${d?"u.organization_id::text AS organization_id":"NULL::text AS organization_id"},
        ${e?"u.approval_state::text AS approval_state":"NULL::text AS approval_state"},
        u.last_login_at::text AS last_login_at,
        ${i?"COUNT(tpa.patient_id)::int AS assigned_patient_count":"0::int AS assigned_patient_count"}
      FROM app_users u
      JOIN patient_pii pii ON pii.patient_id = u.patient_id
      ${s}
      ${q}
      GROUP BY
        u.user_id,
        pii.full_name,
        u.login_id,
        u.last_login_at
        ${d?", u.organization_id":""}
        ${e?", u.approval_state":""}
      ORDER BY pii.full_name ASC
    `,r),u=await (0,h.getTherapistRegistrationProfilesByUserIds)(t.rows.map(a=>String(a.therapist_user_id))),v=new Map(u.map(a=>[a.userId,a]));return t.rows.map(a=>({therapistUserId:String(a.therapist_user_id),therapistName:String(a.therapist_name),loginId:a.login_id?String(a.login_id):null,organizationId:a.organization_id?String(a.organization_id):null,organizationName:a.organization_id?p.get(String(a.organization_id))??null:null,requestedOrganizationName:v.get(String(a.therapist_user_id))?.requestedOrganizationName??null,approvalState:a.approval_state?String(a.approval_state):null,assignedPatientCount:Number(a.assigned_patient_count??0),lastLoginAt:a.last_login_at?String(a.last_login_at):null,phone:v.get(String(a.therapist_user_id))?.phone??null,email:v.get(String(a.therapist_user_id))?.email??null,profession:v.get(String(a.therapist_user_id))?.profession??null,licenseNumber:v.get(String(a.therapist_user_id))?.licenseNumber??null,licenseFileName:v.get(String(a.therapist_user_id))?.licenseFileName??null,licenseIssuedBy:v.get(String(a.therapist_user_id))?.licenseIssuedBy??null,licenseIssuedDate:v.get(String(a.therapist_user_id))?.licenseIssuedDate??null,employmentStatus:v.get(String(a.therapist_user_id))?.employmentStatus??null,department:v.get(String(a.therapist_user_id))?.department??null,twoFactorMethod:v.get(String(a.therapist_user_id))?.twoFactorMethod??null,accessRole:v.get(String(a.therapist_user_id))?.accessRole??null,canViewPatients:v.get(String(a.therapist_user_id))?.canViewPatients??!1,canEditPatientData:v.get(String(a.therapist_user_id))?.canEditPatientData??!1,canEnterEvaluation:v.get(String(a.therapist_user_id))?.canEnterEvaluation??!1,experienceYears:v.get(String(a.therapist_user_id))?.experienceYears??null,specialties:v.get(String(a.therapist_user_id))?.specialties??null,servicePurpose:v.get(String(a.therapist_user_id))?.servicePurpose??null,targetPatientTypes:v.get(String(a.therapist_user_id))?.targetPatientTypes??null,dataConsentScope:v.get(String(a.therapist_user_id))?.dataConsentScope??null,irbParticipation:v.get(String(a.therapist_user_id))?.irbParticipation??null,privacyAgreed:v.get(String(a.therapist_user_id))?.privacyAgreed??!1,patientDataAccessAgreed:v.get(String(a.therapist_user_id))?.patientDataAccessAgreed??!1,securityPolicyAgreed:v.get(String(a.therapist_user_id))?.securityPolicyAgreed??!1,confidentialityAgreed:v.get(String(a.therapist_user_id))?.confidentialityAgreed??!1}))}[d,e,g]=i.then?(await i)():i,a.s(["getTherapistPatientReportDetail",()=>s,"listTherapistColleagueSummaries",()=>t,"listTherapistPatientReportSummaries",()=>q,"listTherapistReportValidationSample",()=>r]),c()}catch(a){c(a)}},!1)];

//# sourceMappingURL=src_lib_server_d6d76cb6._.js.map