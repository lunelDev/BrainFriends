module.exports=[70406,(e,t,i)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,i)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},23862,e=>e.a(async(t,i)=>{try{let t=await e.y("pg-587764f78a6c7a9c");e.n(t),i()}catch(e){i(e)}},!0),63528,e=>e.a(async(t,i)=>{try{var n=e.i(23862),a=t([n]);[n]=a.then?(await a)():a;let s=process.env.DATABASE_URL;function r(){if(!s)throw Error("missing_database_url");return global.__brainfriendsPgPool||(global.__brainfriendsPgPool=new n.Pool({connectionString:s,ssl:"require"===process.env.DATABASE_SSL&&{rejectUnauthorized:!1}})),global.__brainfriendsPgPool}s||console.warn("[db] DATABASE_URL is not configured. Database writes are disabled."),e.s(["getDbPool",()=>r]),i()}catch(e){i(e)}},!1),77545,e=>e.a(async(t,i)=>{try{var n=e.i(54799),a=e.i(63528),r=t([a]);function s(e){return(0,n.createHash)("sha256").update(e).digest("hex")}function o(e){let t=s(e).slice(0,32).split("");t[12]="5",t[16]=(3&parseInt(t[16],16)|8).toString(16);let i=t.join("");return`${i.slice(0,8)}-${i.slice(8,12)}-${i.slice(12,16)}-${i.slice(16,20)}-${i.slice(20,32)}`}function u(e){return[e.name.trim(),e.birthDate??"",e.gender,e.phone??"",e.language??"ko"].join("|")}function d(e){let t=u(e);return`psn_${s(t).slice(0,24)}`}async function l(e,t){let i=u(t),n=o(`patient:${i}`),a=`PT-${n.slice(0,8).toUpperCase()}`,r=d(t);return await e.query(`
      INSERT INTO patient_pii (
        patient_id,
        patient_code,
        full_name,
        birth_date,
        sex,
        phone,
        language,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (patient_id) DO UPDATE
      SET
        patient_code = EXCLUDED.patient_code,
        full_name = EXCLUDED.full_name,
        birth_date = EXCLUDED.birth_date,
        sex = EXCLUDED.sex,
        phone = EXCLUDED.phone,
        language = EXCLUDED.language,
        updated_at = NOW()
    `,[n,a,t.name.trim(),t.birthDate||null,t.gender||"U",t.phone||null,t.language||"ko"]),await e.query(`
      INSERT INTO patient_pseudonym_map (
        patient_pseudonym_id,
        patient_id,
        mapping_version,
        created_at
      )
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (patient_pseudonym_id) DO UPDATE
      SET
        patient_id = EXCLUDED.patient_id,
        mapping_version = EXCLUDED.mapping_version
    `,[r,n,"pseudonym-map-v1"]),{patientId:n,patientCode:a,patientPseudonymId:r}}async function p(e){let t=(0,a.getDbPool)(),i=await t.connect();try{await i.query("BEGIN");let t=await l(i,e);return await i.query("COMMIT"),t}catch(e){throw await i.query("ROLLBACK"),e}finally{i.release()}}[a]=r.then?(await r)():r,e.s(["buildPatientPseudonymId",()=>d,"deterministicUuid",()=>o,"ensurePatientIdentity",()=>p,"hashValue",()=>s,"upsertPatientIdentity",()=>l]),i()}catch(e){i(e)}},!1),66680,(e,t,i)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},24868,(e,t,i)=>{t.exports=e.x("fs/promises",()=>require("fs/promises"))},12714,(e,t,i)=>{t.exports=e.x("node:fs/promises",()=>require("node:fs/promises"))},18622,(e,t,i)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,i)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,i)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,i)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},14747,(e,t,i)=>{t.exports=e.x("path",()=>require("path"))},54799,(e,t,i)=>{t.exports=e.x("crypto",()=>require("crypto"))},50227,(e,t,i)=>{t.exports=e.x("node:path",()=>require("node:path"))},57342,e=>{"use strict";var t=e.i(24868),i=e.i(14747),n=e.i(54799);let a=i.default.join(process.cwd(),"data","organizations"),r=i.default.join(a,"registration-requests.json");async function s(){await (0,t.mkdir)(a,{recursive:!0})}function o(e){let{businessLicenseFileDataUrl:t,adminPasswordHash:i,...n}=e;return n}async function u(){await s();try{let e=await (0,t.readFile)(r,"utf8"),i=JSON.parse(e);return Array.isArray(i)?i:[]}catch{return[]}}async function d(e){await s(),await (0,t.writeFile)(r,JSON.stringify(e,null,2),"utf8")}function l(e){return String(e??"").replace(/[^\d-]/g,"").trim()}function p(e){return String(e??"").trim().toLowerCase()}async function c(){return(await u()).sort((e,t)=>e.createdAt<t.createdAt?1:-1).map(o)}async function g(e){let t,i={id:n.default.randomUUID(),organizationName:String(e.organizationName??"").trim(),businessNumber:(t=(e.businessNumber??"").replace(/\D/g,"").slice(0,10)).length<=3?t:t.length<=5?`${t.slice(0,3)}-${t.slice(3)}`:`${t.slice(0,3)}-${t.slice(3,5)}-${t.slice(5,10)}`,representativeName:String(e.representativeName??"").trim(),organizationType:String(e.organizationType??"").trim(),openedDate:function(e){let t=String(e??"").trim();if(t){if(Number.isNaN(new Date(t).getTime()))throw Error("invalid_request_payload");return t}}(e.openedDate),businessLicenseFileName:String(e.businessLicenseFileName??"").trim(),businessLicenseFileDataUrl:String(e.businessLicenseFileDataUrl??"").trim()||void 0,careInstitutionNumber:String(e.careInstitutionNumber??"").trim(),medicalInstitutionCode:String(e.medicalInstitutionCode??"").trim()||void 0,medicalDepartments:String(e.medicalDepartments??"").trim()||void 0,bedCount:"number"==typeof e.bedCount&&Number.isFinite(e.bedCount)?e.bedCount:void 0,organizationPhone:l(e.organizationPhone??""),postalCode:String(e.postalCode??"").trim(),roadAddress:String(e.roadAddress??"").trim(),addressDetail:String(e.addressDetail??"").trim(),contactName:String(e.contactName??"").trim(),contactTitle:String(e.contactTitle??"").trim()||void 0,contactPhone:l(e.contactPhone??""),contactEmail:p(e.contactEmail??""),adminLoginEmail:p(e.adminLoginEmail??"")||void 0,adminPasswordHash:function(e){let t=String(e??"").trim();if(t)return n.default.createHash("sha256").update(t).digest("hex")}(e.adminPassword),twoFactorMethod:"sms"===e.twoFactorMethod?"sms":void 0,billingEmail:p(e.billingEmail??"")||void 0,bankName:String(e.bankName??"").trim()||void 0,bankAccountNumber:String(e.bankAccountNumber??"").trim()||void 0,bankAccountHolder:String(e.bankAccountHolder??"").trim()||void 0,servicePurpose:String(e.servicePurpose??"").trim()||void 0,targetPatients:String(e.targetPatients??"").trim()||void 0,doctorName:String(e.doctorName??"").trim()||void 0,doctorLicenseNumber:String(e.doctorLicenseNumber??"").trim()||void 0,irbStatus:"planned"===e.irbStatus||"approved"===e.irbStatus?e.irbStatus:void 0,termsAgreed:!!e.termsAgreed,privacyAgreed:!!e.privacyAgreed,medicalDataAgreed:!!e.medicalDataAgreed,contractAgreed:!!e.contractAgreed,patientDataAgreed:!!e.patientDataAgreed,status:"pending",createdAt:new Date().toISOString()};if([!!i.organizationName,!!i.businessNumber,!!i.representativeName,!!i.organizationType,!!i.businessLicenseFileName,!!i.careInstitutionNumber,!!i.contactName,!!i.contactEmail,!!i.contactPhone,i.termsAgreed,i.privacyAgreed,i.medicalDataAgreed].some(e=>!e))throw Error("invalid_request_payload");let a=await u();if(a.find(e=>e.organizationName===i.organizationName||e.businessNumber===i.businessNumber||e.careInstitutionNumber===i.careInstitutionNumber))throw Error("organization_already_exists");return a.unshift(i),await d(a),o(i)}async function m(e){let t=await u(),i=t.findIndex(t=>t.id===e.requestId);if(i<0)throw Error("request_not_found");let n=t[i];if("pending"!==n.status)throw Error("request_already_reviewed");let a={...n,status:e.status,reviewedAt:new Date().toISOString(),reviewedBy:String(e.reviewerLoginId??"").trim()||void 0};return t[i]=a,await d(t),o(a)}e.s(["createOrganizationRegistrationRequest",()=>g,"listOrganizationRegistrationRequests",()=>c,"reviewOrganizationRegistrationRequest",()=>m])},92768,e=>{"use strict";var t=e.i(12714),i=e.i(50227),n=e.i(66680);let a=[];var r=e.i(57342);let s=i.default.join(process.cwd(),"data","organizations"),o=i.default.join(s,"manual-organizations.json");async function u(){await (0,t.mkdir)(s,{recursive:!0})}async function d(){await u();try{let e=await (0,t.readFile)(o,"utf8"),i=JSON.parse(e);return Array.isArray(i)?i:[]}catch(e){if("ENOENT"===(e&&"object"==typeof e&&"code"in e?String(e.code):""))return[];throw e}}async function l(e){await u(),await (0,t.writeFile)(o,JSON.stringify(e,null,2),"utf8")}async function p(){let e=await d();return[...a.map(e=>({...e,source:"builtin"})),...e.map(e=>({...e,source:"manual"}))]}async function c(e){return(await p()).find(t=>t.id===e)??null}async function g(e){let t=String(e.name??"").trim(),i=String(e.businessNumber??"").trim(),n=String(e.careInstitutionNumber??"").trim();if(!t&&!i&&!n)return null;for(let e of(await p())){if(t&&e.name===t)return{source:"manual",field:"name",existingId:e.id};let a=e.businessNumber?.trim();if(i&&a&&a===i)return{source:"manual",field:"businessNumber",existingId:e.id};let r=e.careInstitutionNumber?.trim();if(n&&r&&r===n)return{source:"manual",field:"careInstitutionNumber",existingId:e.id}}for(let e of(await (0,r.listOrganizationRegistrationRequests)()))if("pending"===e.status){if(t&&e.organizationName===t)return{source:"request",field:"name",existingId:e.id};if(i&&e.businessNumber===i)return{source:"request",field:"businessNumber",existingId:e.id};if(n&&e.careInstitutionNumber===n)return{source:"request",field:"careInstitutionNumber",existingId:e.id}}return null}async function m(e){let t=String(e??"").trim();return t?(await p()).find(e=>e.name===t)??null:null}async function _(e){let t,i=e.name.trim(),a=e.address.trim();if(!i||!a)throw Error("invalid_organization_payload");let r=await d();if(r.find(t=>t.name===i||t.businessNumber===e.businessNumber))throw Error("organization_already_exists");let s={id:(0,n.randomUUID)(),code:(t=i.replace(/\s+/g,"").slice(0,8).toUpperCase(),`ORG-${t||"CUSTOM"}-${Date.now().toString().slice(-6)}`),name:i,address:a,businessNumber:String(e.businessNumber??"").trim()||void 0,representativeName:String(e.representativeName??"").trim()||void 0,organizationPhone:String(e.organizationPhone??"").trim()||void 0,organizationType:String(e.organizationType??"").trim()||void 0,careInstitutionNumber:String(e.careInstitutionNumber??"").trim()||void 0,medicalInstitutionCode:String(e.medicalInstitutionCode??"").trim()||void 0,medicalDepartments:String(e.medicalDepartments??"").trim()||void 0,postalCode:String(e.postalCode??"").trim()||void 0,roadAddress:String(e.roadAddress??"").trim()||void 0,addressDetail:String(e.addressDetail??"").trim()||void 0,contactName:String(e.contactName??"").trim()||void 0,contactTitle:String(e.contactTitle??"").trim()||void 0,contactPhone:String(e.contactPhone??"").trim()||void 0,contactEmail:String(e.contactEmail??"").trim()||void 0,adminLoginEmail:String(e.adminLoginEmail??"").trim()||void 0,twoFactorMethod:e.twoFactorMethod,servicePurpose:String(e.servicePurpose??"").trim()||void 0,targetPatients:String(e.targetPatients??"").trim()||void 0,doctorName:String(e.doctorName??"").trim()||void 0,doctorLicenseNumber:String(e.doctorLicenseNumber??"").trim()||void 0,createdAt:new Date().toISOString(),source:"manual"};return r.unshift(s),await l(r),s}e.s(["createManagedOrganization",()=>_,"findApprovedOrganizationByName",()=>m,"findOrganizationDuplicate",()=>g,"getAvailableOrganizationById",()=>c,"listAvailableOrganizations",()=>p],92768)},65093,e=>{"use strict";function t(){return"1"===process.env.VERCEL}e.s(["isServerPersistenceDisabled",()=>t])},71106,e=>e.a(async(t,i)=>{try{var n=e.i(54799),a=e.i(32476),r=e.i(63528),s=t([a,r]);[a,r]=s.then?(await s)():s;let p=null;async function o(){p||(p=(async()=>{let e=(0,r.getDbPool)();await e.query(`
        CREATE TABLE IF NOT EXISTS training_usage_events (
          usage_event_id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
          patient_id UUID NOT NULL REFERENCES patient_pii(patient_id) ON DELETE CASCADE,
          patient_pseudonym_id VARCHAR(64) NOT NULL REFERENCES patient_pseudonym_map(patient_pseudonym_id),
          event_type VARCHAR(100) NOT NULL,
          event_status VARCHAR(20) NOT NULL DEFAULT 'success',
          training_type VARCHAR(50),
          step_no INTEGER,
          page_path VARCHAR(200),
          session_id UUID,
          payload JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)})().catch(e=>{throw p=null,e})),await p}async function u(e,t){let i=await (0,a.getAuthenticatedSessionContext)(e);if(!i)throw Error("unauthorized");await o();let s=(0,r.getDbPool)();await s.query(`
      INSERT INTO training_usage_events (
        usage_event_id,
        user_id,
        patient_id,
        patient_pseudonym_id,
        event_type,
        event_status,
        training_type,
        step_no,
        page_path,
        session_id,
        payload,
        created_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        CASE WHEN $10::text IS NULL OR $10::text = '' THEN NULL ELSE $10::uuid END,
        $11::jsonb,
        NOW()
      )
    `,[(0,n.randomUUID)(),i.userId,i.patientId,i.patientPseudonymId,t.eventType,t.eventStatus??"success",t.trainingType??null,t.stepNo??null,t.pagePath??null,t.sessionId??null,JSON.stringify(t.payload??{})])}async function d(e,t=200){let i=await (0,a.getAuthenticatedSessionContext)(e);if(!i)throw Error("unauthorized");await o();let n=Number.isFinite(t)?Math.min(Math.max(Math.floor(t),1),500):200,s=(0,r.getDbPool)(),u=(await s.query(`
      SELECT
        usage_event_id::text AS usage_event_id,
        event_type,
        event_status,
        training_type,
        step_no,
        page_path,
        session_id::text AS session_id,
        payload,
        created_at
      FROM training_usage_events
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,[i.userId,n])).rows.map(e=>({usageEventId:String(e.usage_event_id),eventType:String(e.event_type),eventStatus:String(e.event_status),trainingType:e.training_type?String(e.training_type):null,stepNo:null==e.step_no?null:Number(e.step_no),pagePath:e.page_path?String(e.page_path):null,sessionId:e.session_id?String(e.session_id):null,payload:e.payload&&"object"==typeof e.payload?e.payload:{},createdAt:new Date(e.created_at).toISOString()}));return{patient:i.patient,userId:i.userId,patientId:i.patientId,patientPseudonymId:i.patientPseudonymId,events:u}}async function l(e,t=500){let i=await (0,a.getAuthenticatedSessionContext)(e);if(!i)throw Error("unauthorized");await o();let n=Number.isFinite(t)?Math.min(Math.max(Math.floor(t),1),2e3):500,s=(0,r.getDbPool)(),u=(await s.query(`
      SELECT
        tue.usage_event_id::text AS usage_event_id,
        tue.patient_pseudonym_id,
        pii.full_name,
        pii.patient_code,
        au.login_id,
        tue.event_type,
        tue.event_status,
        tue.training_type,
        tue.step_no,
        tue.page_path,
        tue.session_id::text AS session_id,
        tue.payload,
        tue.created_at
      FROM training_usage_events tue
      JOIN patient_pii pii ON pii.patient_id = tue.patient_id
      LEFT JOIN app_users au ON au.patient_id = tue.patient_id
      ORDER BY tue.created_at DESC
      LIMIT $1
    `,[n])).rows.map(e=>({usageEventId:String(e.usage_event_id),patientName:String(e.full_name),patientCode:String(e.patient_code),loginId:e.login_id?String(e.login_id):null,patientPseudonymId:String(e.patient_pseudonym_id),eventType:String(e.event_type),eventStatus:String(e.event_status),trainingType:e.training_type?String(e.training_type):null,stepNo:null==e.step_no?null:Number(e.step_no),pagePath:e.page_path?String(e.page_path):null,sessionId:e.session_id?String(e.session_id):null,payload:e.payload&&"object"==typeof e.payload?e.payload:{},createdAt:new Date(e.created_at).toISOString()}));return{requestedBy:{userId:i.userId,patientId:i.patientId,patientPseudonymId:i.patientPseudonymId,patientName:i.patient.name},events:u}}e.s(["listTrainingUsageEventsForAllPatients",()=>l,"listTrainingUsageEventsForAuthenticatedUser",()=>d,"recordTrainingUsageEvent",()=>u]),i()}catch(e){i(e)}},!1),70080,e=>e.a(async(t,i)=>{try{var n=e.i(54799),a=e.i(24868),r=e.i(14747),s=e.i(77545),o=t([s]);function u(e){let t=e.headers.get("x-forwarded-for");return{userAgent:e.headers.get("user-agent"),platform:e.headers.get("sec-ch-ua-platform"),acceptLanguage:e.headers.get("accept-language"),ipAddress:t?t.split(",")[0].trim():null}}function d(e,t){return`${e}_${(0,n.createHash)("sha256").update(t).digest("hex").slice(0,20)}`}async function l(e){let t=r.default.join(process.cwd(),"data","audit"),i=r.default.join(t,"clinical-events.ndjson");return await (0,a.mkdir)(t,{recursive:!0}),await (0,a.appendFile)(i,`${JSON.stringify(e)}
`,"utf8"),i}function p(e){let{request:t,patient:i,sessionId:n,status:a,result:r,failureReason:o,storageTargets:l=[]}=e,p=r?.finalJitter?Number(r.finalJitter):null,c=r?.finalSi?Number(r.finalSi):null,g=r?.rtLatency?Number(String(r.rtLatency).replace(/[^0-9.]/g,"")):null,m=r?{ruleName:"brain-sing-score-pass-threshold",threshold:70,comparator:">=",observedValue:r.score,passed:r.score>=70}:null,_=[i?.sessionId??"unknown",n??"unknown",r?.song??"unknown",a,r?.versionSnapshot?.generated_at??new Date().toISOString()].join("|");return{audit_event_id:d("audit",_),event_type:"sing_training_result_persist",status:a,timestamp:new Date().toISOString(),patient_pseudonym_id:i?(0,s.buildPatientPseudonymId)(i):null,session_id:n??null,operator_user_role:"patient",pipeline_stage:r?.versionSnapshot?.pipeline_stage??"sing",device_info:u(t),raw_input_metadata:{inputKind:"multimodal",audioEncoding:r?.reviewAudioUrl?.startsWith("data:audio/webm")?"audio/webm":null,reviewAudioAttached:!!r?.reviewAudioUrl,songKey:r?.song??null},preprocessing_version:r?.versionSnapshot?.preprocessing_version??null,feature_values:{jitter_percent:Number.isFinite(p)?p:null,facial_symmetry_index:Number.isFinite(c)?c:null,reaction_latency_ms:Number.isFinite(g)?g:null},final_scores:{overall_score:r?.score??null,jitter_percent:Number.isFinite(p)?p:null,facial_symmetry_index:Number.isFinite(c)?c:null},threshold_decision:m,algorithm_versions:r?.versionSnapshot??null,failure_reason:o??null,storage_targets:l}}function c(e){let{request:t,patient:i,sessionId:n,status:a,historyEntry:r,failureReason:o,storageTargets:l=[]}=e,p=r?.trainingMode??"self",c=r?.rehabStep?`step${r.rehabStep}`:"rehab"===p?"rehab":"self-assessment",g=[i?.sessionId??"unknown",n??r?.sessionId??"unknown",r?.historyId??"unknown",a,String(r?.completedAt??Date.now())].join("|"),m=r?.stepScores,_=r?.aq??null;return{audit_event_id:d("audit",g),event_type:"training_history_persist",status:a,timestamp:new Date().toISOString(),patient_pseudonym_id:i?(0,s.buildPatientPseudonymId)(i):null,session_id:n??r?.sessionId??null,operator_user_role:"patient",pipeline_stage:c,device_info:u(t),raw_input_metadata:{inputKind:r?.rehabStep===6?"writing":"multimodal",trainingMode:p,rehabStep:r?.rehabStep??null},preprocessing_version:r?.rehabStep&&r.stepVersionSnapshots?r.stepVersionSnapshots[`step${r.rehabStep}`]?.preprocessing_version??null:null,feature_values:{aq:r?.aq??null,step1_score:m?.step1??null,step2_score:m?.step2??null,step3_score:m?.step3??null,step4_score:m?.step4??null,step5_score:m?.step5??null,step6_score:m?.step6??null,asymmetry_risk:r?.facialAnalysisSnapshot?.asymmetryRisk??null,articulation_gap:r?.facialAnalysisSnapshot?.articulationGap??null,vnv_requirement_count:r?.vnv?.summary.requirementIds.length??null,vnv_test_case_count:r?.vnv?.summary.testCaseIds.length??null},final_scores:{aq:r?.aq??null,rehab_step:r?.rehabStep??null,step1:m?.step1??null,step2:m?.step2??null,step3:m?.step3??null,step4:m?.step4??null,step5:m?.step5??null,step6:m?.step6??null,measurement_quality:r?.measurementQuality?.overall??null},threshold_decision:null===_?null:{ruleName:"aq-monitoring-threshold",threshold:50,comparator:">=",observedValue:_,passed:_>=50},algorithm_versions:r?.stepVersionSnapshots??null,failure_reason:o??null,storage_targets:l}}[s]=o.then?(await o)():o,e.s(["appendClinicalAuditLog",()=>l,"buildSingTrainingAuditLog",()=>p,"buildTrainingHistoryAuditLog",()=>c]),i()}catch(e){i(e)}},!1)];

//# sourceMappingURL=%5Broot-of-the-server%5D__a59c8521._.js.map