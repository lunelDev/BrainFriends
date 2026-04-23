module.exports=[70406,(e,t,i)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,i)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},23862,e=>e.a(async(t,i)=>{try{let t=await e.y("pg-587764f78a6c7a9c");e.n(t),i()}catch(e){i(e)}},!0),63528,e=>e.a(async(t,i)=>{try{var r=e.i(23862),n=t([r]);[r]=n.then?(await n)():n;let s=process.env.DATABASE_URL;function a(){if(!s)throw Error("missing_database_url");return global.__brainfriendsPgPool||(global.__brainfriendsPgPool=new r.Pool({connectionString:s,ssl:"require"===process.env.DATABASE_SSL&&{rejectUnauthorized:!1}})),global.__brainfriendsPgPool}s||console.warn("[db] DATABASE_URL is not configured. Database writes are disabled."),e.s(["getDbPool",()=>a]),i()}catch(e){i(e)}},!1),77545,e=>e.a(async(t,i)=>{try{var r=e.i(54799),n=e.i(63528),a=t([n]);function s(e){return(0,r.createHash)("sha256").update(e).digest("hex")}function o(e){let t=s(e).slice(0,32).split("");t[12]="5",t[16]=(3&parseInt(t[16],16)|8).toString(16);let i=t.join("");return`${i.slice(0,8)}-${i.slice(8,12)}-${i.slice(12,16)}-${i.slice(16,20)}-${i.slice(20,32)}`}function d(e){return[e.name.trim(),e.birthDate??"",e.gender,e.phone??"",e.language??"ko"].join("|")}function u(e){let t=d(e);return`psn_${s(t).slice(0,24)}`}async function l(e,t){let i=d(t),r=o(`patient:${i}`),n=`PT-${r.slice(0,8).toUpperCase()}`,a=u(t);return await e.query(`
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
    `,[r,n,t.name.trim(),t.birthDate||null,t.gender||"U",t.phone||null,t.language||"ko"]),await e.query(`
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
    `,[a,r,"pseudonym-map-v1"]),{patientId:r,patientCode:n,patientPseudonymId:a}}async function c(e){let t=(0,n.getDbPool)(),i=await t.connect();try{await i.query("BEGIN");let t=await l(i,e);return await i.query("COMMIT"),t}catch(e){throw await i.query("ROLLBACK"),e}finally{i.release()}}[n]=a.then?(await a)():a,e.s(["buildPatientPseudonymId",()=>u,"deterministicUuid",()=>o,"ensurePatientIdentity",()=>c,"hashValue",()=>s,"upsertPatientIdentity",()=>l]),i()}catch(e){i(e)}},!1),66680,(e,t,i)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},24868,(e,t,i)=>{t.exports=e.x("fs/promises",()=>require("fs/promises"))},12714,(e,t,i)=>{t.exports=e.x("node:fs/promises",()=>require("node:fs/promises"))},18622,(e,t,i)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,i)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,i)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,i)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},14747,(e,t,i)=>{t.exports=e.x("path",()=>require("path"))},54799,(e,t,i)=>{t.exports=e.x("crypto",()=>require("crypto"))},50227,(e,t,i)=>{t.exports=e.x("node:path",()=>require("node:path"))},57342,e=>{"use strict";var t=e.i(24868),i=e.i(14747),r=e.i(54799);let n=i.default.join(process.cwd(),"data","organizations"),a=i.default.join(n,"registration-requests.json");async function s(){await (0,t.mkdir)(n,{recursive:!0})}function o(e){let{businessLicenseFileDataUrl:t,adminPasswordHash:i,...r}=e;return r}async function d(){await s();try{let e=await (0,t.readFile)(a,"utf8"),i=JSON.parse(e);return Array.isArray(i)?i:[]}catch{return[]}}async function u(e){await s(),await (0,t.writeFile)(a,JSON.stringify(e,null,2),"utf8")}function l(e){return String(e??"").replace(/[^\d-]/g,"").trim()}function c(e){return String(e??"").trim().toLowerCase()}async function p(){return(await d()).sort((e,t)=>e.createdAt<t.createdAt?1:-1).map(o)}async function m(e){let t,i={id:r.default.randomUUID(),organizationName:String(e.organizationName??"").trim(),businessNumber:(t=(e.businessNumber??"").replace(/\D/g,"").slice(0,10)).length<=3?t:t.length<=5?`${t.slice(0,3)}-${t.slice(3)}`:`${t.slice(0,3)}-${t.slice(3,5)}-${t.slice(5,10)}`,representativeName:String(e.representativeName??"").trim(),organizationType:String(e.organizationType??"").trim(),openedDate:function(e){let t=String(e??"").trim();if(t){if(Number.isNaN(new Date(t).getTime()))throw Error("invalid_request_payload");return t}}(e.openedDate),businessLicenseFileName:String(e.businessLicenseFileName??"").trim(),businessLicenseFileDataUrl:String(e.businessLicenseFileDataUrl??"").trim()||void 0,careInstitutionNumber:String(e.careInstitutionNumber??"").trim(),medicalInstitutionCode:String(e.medicalInstitutionCode??"").trim()||void 0,medicalDepartments:String(e.medicalDepartments??"").trim()||void 0,bedCount:"number"==typeof e.bedCount&&Number.isFinite(e.bedCount)?e.bedCount:void 0,organizationPhone:l(e.organizationPhone??""),postalCode:String(e.postalCode??"").trim(),roadAddress:String(e.roadAddress??"").trim(),addressDetail:String(e.addressDetail??"").trim(),contactName:String(e.contactName??"").trim(),contactTitle:String(e.contactTitle??"").trim()||void 0,contactPhone:l(e.contactPhone??""),contactEmail:c(e.contactEmail??""),adminLoginEmail:c(e.adminLoginEmail??"")||void 0,adminPasswordHash:function(e){let t=String(e??"").trim();if(t)return r.default.createHash("sha256").update(t).digest("hex")}(e.adminPassword),twoFactorMethod:"sms"===e.twoFactorMethod?"sms":void 0,billingEmail:c(e.billingEmail??"")||void 0,bankName:String(e.bankName??"").trim()||void 0,bankAccountNumber:String(e.bankAccountNumber??"").trim()||void 0,bankAccountHolder:String(e.bankAccountHolder??"").trim()||void 0,servicePurpose:String(e.servicePurpose??"").trim()||void 0,targetPatients:String(e.targetPatients??"").trim()||void 0,doctorName:String(e.doctorName??"").trim()||void 0,doctorLicenseNumber:String(e.doctorLicenseNumber??"").trim()||void 0,irbStatus:"planned"===e.irbStatus||"approved"===e.irbStatus?e.irbStatus:void 0,termsAgreed:!!e.termsAgreed,privacyAgreed:!!e.privacyAgreed,medicalDataAgreed:!!e.medicalDataAgreed,contractAgreed:!!e.contractAgreed,patientDataAgreed:!!e.patientDataAgreed,status:"pending",createdAt:new Date().toISOString()};if([!!i.organizationName,!!i.businessNumber,!!i.representativeName,!!i.organizationType,!!i.businessLicenseFileName,!!i.careInstitutionNumber,!!i.contactName,!!i.contactEmail,!!i.contactPhone,i.termsAgreed,i.privacyAgreed,i.medicalDataAgreed].some(e=>!e))throw Error("invalid_request_payload");let n=await d();if(n.find(e=>e.organizationName===i.organizationName||e.businessNumber===i.businessNumber||e.careInstitutionNumber===i.careInstitutionNumber))throw Error("organization_already_exists");return n.unshift(i),await u(n),o(i)}async function g(e){let t=await d(),i=t.findIndex(t=>t.id===e.requestId);if(i<0)throw Error("request_not_found");let r=t[i];if("pending"!==r.status)throw Error("request_already_reviewed");let n={...r,status:e.status,reviewedAt:new Date().toISOString(),reviewedBy:String(e.reviewerLoginId??"").trim()||void 0};return t[i]=n,await u(t),o(n)}e.s(["createOrganizationRegistrationRequest",()=>m,"listOrganizationRegistrationRequests",()=>p,"reviewOrganizationRegistrationRequest",()=>g])},92768,e=>{"use strict";var t=e.i(12714),i=e.i(50227),r=e.i(66680);let n=[];var a=e.i(57342);let s=i.default.join(process.cwd(),"data","organizations"),o=i.default.join(s,"manual-organizations.json");async function d(){await (0,t.mkdir)(s,{recursive:!0})}async function u(){await d();try{let e=await (0,t.readFile)(o,"utf8"),i=JSON.parse(e);return Array.isArray(i)?i:[]}catch(e){if("ENOENT"===(e&&"object"==typeof e&&"code"in e?String(e.code):""))return[];throw e}}async function l(e){await d(),await (0,t.writeFile)(o,JSON.stringify(e,null,2),"utf8")}async function c(){let e=await u();return[...n.map(e=>({...e,source:"builtin"})),...e.map(e=>({...e,source:"manual"}))]}async function p(e){return(await c()).find(t=>t.id===e)??null}async function m(e){let t=String(e.name??"").trim(),i=String(e.businessNumber??"").trim(),r=String(e.careInstitutionNumber??"").trim();if(!t&&!i&&!r)return null;for(let e of(await c())){if(t&&e.name===t)return{source:"manual",field:"name",existingId:e.id};let n=e.businessNumber?.trim();if(i&&n&&n===i)return{source:"manual",field:"businessNumber",existingId:e.id};let a=e.careInstitutionNumber?.trim();if(r&&a&&a===r)return{source:"manual",field:"careInstitutionNumber",existingId:e.id}}for(let e of(await (0,a.listOrganizationRegistrationRequests)()))if("pending"===e.status){if(t&&e.organizationName===t)return{source:"request",field:"name",existingId:e.id};if(i&&e.businessNumber===i)return{source:"request",field:"businessNumber",existingId:e.id};if(r&&e.careInstitutionNumber===r)return{source:"request",field:"careInstitutionNumber",existingId:e.id}}return null}async function g(e){let t=String(e??"").trim();return t?(await c()).find(e=>e.name===t)??null:null}async function _(e){let t,i=e.name.trim(),n=e.address.trim();if(!i||!n)throw Error("invalid_organization_payload");let a=await u();if(a.find(t=>t.name===i||t.businessNumber===e.businessNumber))throw Error("organization_already_exists");let s={id:(0,r.randomUUID)(),code:(t=i.replace(/\s+/g,"").slice(0,8).toUpperCase(),`ORG-${t||"CUSTOM"}-${Date.now().toString().slice(-6)}`),name:i,address:n,businessNumber:String(e.businessNumber??"").trim()||void 0,representativeName:String(e.representativeName??"").trim()||void 0,organizationPhone:String(e.organizationPhone??"").trim()||void 0,organizationType:String(e.organizationType??"").trim()||void 0,careInstitutionNumber:String(e.careInstitutionNumber??"").trim()||void 0,medicalInstitutionCode:String(e.medicalInstitutionCode??"").trim()||void 0,medicalDepartments:String(e.medicalDepartments??"").trim()||void 0,postalCode:String(e.postalCode??"").trim()||void 0,roadAddress:String(e.roadAddress??"").trim()||void 0,addressDetail:String(e.addressDetail??"").trim()||void 0,contactName:String(e.contactName??"").trim()||void 0,contactTitle:String(e.contactTitle??"").trim()||void 0,contactPhone:String(e.contactPhone??"").trim()||void 0,contactEmail:String(e.contactEmail??"").trim()||void 0,adminLoginEmail:String(e.adminLoginEmail??"").trim()||void 0,twoFactorMethod:e.twoFactorMethod,servicePurpose:String(e.servicePurpose??"").trim()||void 0,targetPatients:String(e.targetPatients??"").trim()||void 0,doctorName:String(e.doctorName??"").trim()||void 0,doctorLicenseNumber:String(e.doctorLicenseNumber??"").trim()||void 0,createdAt:new Date().toISOString(),source:"manual"};return a.unshift(s),await l(a),s}e.s(["createManagedOrganization",()=>_,"findApprovedOrganizationByName",()=>g,"findOrganizationDuplicate",()=>m,"getAvailableOrganizationById",()=>p,"listAvailableOrganizations",()=>c],92768)},87128,e=>e.a(async(t,i)=>{try{var r=e.i(63528),n=e.i(32476),a=t([r,n]);function s(e){if("string"!=typeof e)return!1;let t=e.trim();return!!t&&(t.startsWith("data:audio/")||t.startsWith("blob:")||t.startsWith("/api/media/access?")||/^https?:\/\//i.test(t))}async function o(e){let t=await (0,n.getAuthenticatedSessionContext)(e);if(!t)throw Error("unauthorized");let i=(0,r.getDbPool)(),[a,o]=await Promise.all([i.query(`
        SELECT
          'language-training' AS kind,
          cs.training_type,
          ltr.training_mode,
          ltr.rehab_step,
          cs.session_id::text AS session_id,
          cs.source_session_key,
          ltr.result_id::text AS result_id,
          ltr.source_history_id,
          ltr.aq,
          NULL::numeric AS score,
          NULL::text AS song_key,
          cs.completed_at,
          ltr.created_at,
          ltr.step_scores,
          ltr.step_details,
          ltr.articulation_scores,
          ltr.facial_analysis_snapshot,
          ltr.measurement_quality,
          ltr.step_version_snapshots,
          NULL::numeric AS jitter,
          NULL::numeric AS facial_symmetry,
          NULL::numeric AS latency_ms,
          NULL::text AS comment,
          cs.version_snapshot
        FROM language_training_results ltr
        JOIN clinical_sessions cs ON cs.session_id = ltr.session_id
        WHERE ltr.patient_pseudonym_id = $1
      `,[t.patientPseudonymId]),i.query(`
        SELECT
          'sing-training' AS kind,
          cs.training_type,
          NULL::text AS training_mode,
          NULL::integer AS rehab_step,
          cs.session_id::text AS session_id,
          cs.source_session_key,
          sr.result_id::text AS result_id,
          NULL::text AS source_history_id,
          NULL::numeric AS aq,
          sr.score,
          sr.song_key,
          cs.completed_at,
          sr.created_at,
          NULL::jsonb AS step_scores,
          NULL::jsonb AS step_details,
          NULL::jsonb AS articulation_scores,
          NULL::jsonb AS facial_analysis_snapshot,
          NULL::jsonb AS step_version_snapshots,
          sr.jitter,
          sr.facial_symmetry,
          sr.latency_ms,
          sr.consonant_accuracy,
          sr.vowel_accuracy,
          sr.lyric_accuracy,
          sr.recognized_lyrics,
          sr.comment,
          sr.version_snapshot
        FROM sing_results sr
        JOIN clinical_sessions cs ON cs.session_id = sr.session_id
        WHERE sr.patient_pseudonym_id = $1
      `,[t.patientPseudonymId])]),d=[...a.rows,...o.rows].map(e=>({kind:e.kind,trainingType:String(e.training_type),trainingMode:e.training_mode?String(e.training_mode):null,rehabStep:null==e.rehab_step?null:Number(e.rehab_step),sessionId:String(e.session_id),resultId:String(e.result_id),sourceHistoryId:e.source_history_id?String(e.source_history_id):null,aq:null==e.aq?null:Number(e.aq),score:null==e.score?null:Number(e.score),songKey:e.song_key?String(e.song_key):null,completedAt:new Date(e.completed_at).toISOString(),createdAt:new Date(e.created_at).toISOString(),stepScores:e.step_scores?e.step_scores:null,versionSnapshot:e.version_snapshot?e.version_snapshot:null})).sort((e,t)=>t.completedAt.localeCompare(e.completedAt)),u=t.patient,l=Array.from(new Set(a.rows.map(e=>String(e.source_session_key??"").trim()).filter(e=>e.length>0))),c=Array.from(new Set(o.rows.map(e=>String(e.source_session_key??"").trim()).filter(e=>e.length>0))),p=l.length>0?await i.query(`
            SELECT
              source_session_key,
              object_key,
              uploaded_at
            FROM clinical_media_objects
            WHERE patient_pseudonym_id = $1
              AND training_type IN ('self-assessment', 'speech-rehab')
              AND step_no = 6
              AND media_type = 'image'
              AND capture_role = 'step6-image'
              AND source_session_key = ANY($2::text[])
            ORDER BY source_session_key ASC, uploaded_at ASC
          `,[t.patientPseudonymId,l]):{rows:[]},m=l.length>0?await i.query(`
            SELECT
              source_session_key,
              step_no,
              object_key,
              uploaded_at
            FROM clinical_media_objects
            WHERE patient_pseudonym_id = $1
              AND training_type IN ('self-assessment', 'speech-rehab')
              AND step_no IN (2, 4, 5)
              AND media_type = 'audio'
              AND capture_role IN ('step2-audio', 'step4-audio', 'step5-audio')
              AND source_session_key = ANY($2::text[])
            ORDER BY source_session_key ASC, step_no ASC, uploaded_at ASC
          `,[t.patientPseudonymId,l]):{rows:[]},g=c.length>0?await i.query(`
            SELECT
              source_session_key,
              object_key,
              uploaded_at
            FROM clinical_media_objects
            WHERE patient_pseudonym_id = $1
              AND training_type = 'sing-training'
              AND media_type = 'audio'
              AND capture_role = 'review-audio'
              AND source_session_key = ANY($2::text[])
            ORDER BY source_session_key ASC, uploaded_at DESC
          `,[t.patientPseudonymId,c]):{rows:[]},_=new Map;for(let e of p.rows){let t=String(e.source_session_key??"").trim(),i=String(e.object_key??"").trim();if(!t||!i)continue;let r=_.get(t)??[];r.push(`/api/media/access?objectKey=${encodeURIComponent(i)}`),_.set(t,r)}let y=new Map;for(let e of m.rows){let t=String(e.source_session_key??"").trim(),i=Number(e.step_no??0),r=String(e.object_key??"").trim();if(!t||!i||!r)continue;let n=y.get(t)??{},a=n[i]??[];a.push(`/api/media/access?objectKey=${encodeURIComponent(r)}`),n[i]=a,y.set(t,n)}let h=new Map;for(let e of g.rows){let t=String(e.source_session_key??"").trim(),i=String(e.object_key??"").trim();!t||!i||h.has(t)||h.set(t,`/api/media/access?objectKey=${encodeURIComponent(i)}`)}let f=[...a.rows.map(e=>{let i=String(e.source_session_key??"").trim(),r=_.get(i)??[],n=y.get(i)??{},a=e.step_details??{step1:[],step2:[],step3:[],step4:[],step5:[],step6:[]},o={...a,step2:Array.isArray(a.step2)?a.step2.map((e,t)=>({...e,audioUrl:s(e?.audioUrl)?e.audioUrl:n[2]?.[t]??void 0})):[],step4:Array.isArray(a.step4)?a.step4.map((e,t)=>({...e,audioUrl:s(e?.audioUrl)?e.audioUrl:n[4]?.[t]??void 0})):[],step5:Array.isArray(a.step5)?a.step5.map((e,t)=>({...e,audioUrl:s(e?.audioUrl)?e.audioUrl:n[5]?.[t]??void 0})):[],step6:Array.isArray(a.step6)?a.step6.map((e,t)=>({...e,userImage:!function(e){if("string"!=typeof e)return!1;let t=e.trim();return!!t&&(t.startsWith("data:image/")||t.startsWith("blob:")||t.startsWith("/api/media/access?")||/^https?:\/\//i.test(t))}(e?.userImage)?r[t]??void 0:e.userImage})):[]};return{historyId:e.source_history_id?String(e.source_history_id):String(e.result_id),sessionId:String(e.session_id),patientKey:t.patientPseudonymId,patientName:u.name,birthDate:u.birthDate,age:Number(u.age??0),educationYears:Number(u.educationYears??0),place:"home",trainingMode:"rehab"===e.training_mode?"rehab":"self",rehabStep:null==e.rehab_step?void 0:Number(e.rehab_step),completedAt:new Date(e.completed_at).getTime(),aq:Number(e.aq??0),stepScores:e.step_scores??{step1:0,step2:0,step3:0,step4:0,step5:0,step6:0},stepDetails:o,articulationScores:e.articulation_scores??void 0,facialAnalysisSnapshot:e.facial_analysis_snapshot??void 0,measurementQuality:e.measurement_quality??void 0,stepVersionSnapshots:e.step_version_snapshots??void 0}}),...o.rows.map(e=>{let i=String(e.source_session_key??"").trim();return{historyId:`history_sing_${new Date(e.completed_at).getTime()}`,sessionId:String(e.session_id),patientKey:t.patientPseudonymId,patientName:u.name,birthDate:u.birthDate,age:Number(u.age??0),educationYears:Number(u.educationYears??0),place:"brain-sing",trainingMode:"sing",completedAt:new Date(e.completed_at).getTime(),aq:Number(e.score??0),singResult:{song:String(e.song_key),score:Number(e.score??0),finalJitter:null==e.jitter?"-":String(e.jitter),finalSi:null==e.facial_symmetry?"-":String(e.facial_symmetry),facialResponseDelta:e.version_snapshot?.measurement_metadata?.facial_response_delta==null?"-":String(e.version_snapshot.measurement_metadata.facial_response_delta),rtLatency:null==e.latency_ms?"-":String(e.latency_ms),finalConsonant:null==e.consonant_accuracy?"-":String(e.consonant_accuracy),finalVowel:null==e.vowel_accuracy?"-":String(e.vowel_accuracy),lyricAccuracy:null==e.lyric_accuracy?"-":String(e.lyric_accuracy),transcript:null==e.recognized_lyrics?"":String(e.recognized_lyrics),reviewAudioUrl:h.get(i),comment:e.comment?String(e.comment):"",rankings:[],versionSnapshot:e.version_snapshot??void 0},stepScores:{step1:0,step2:0,step3:0,step4:0,step5:0,step6:0},stepDetails:{step1:[],step2:[],step3:[],step4:[],step5:[],step6:[]}}})].sort((e,t)=>t.completedAt-e.completedAt);return{patient:u,history:d,entries:f}}async function d(e){let t=await (0,n.getAuthenticatedSessionContext)(e);if(!t)throw Error("unauthorized");let i=(0,r.getDbPool)(),a=await i.query(`
      SELECT COUNT(*)::int AS row_count
      FROM language_training_results ltr
      JOIN clinical_sessions cs ON cs.session_id = ltr.session_id
      WHERE ltr.patient_pseudonym_id = $1
        AND cs.training_type = 'self-assessment'
    `,[t.patientPseudonymId]);return{patient:t.patient,hasSelfAssessmentHistory:Number(a.rows[0]?.row_count??0)>0}}async function u(e,t){let i=await (0,n.getAuthenticatedSessionContext)(e);if(!i)throw Error("unauthorized");let a=Array.from(new Set(t.map(e=>String(e||"").trim()).filter(e=>e.length>0)));if(!a.length)return{deletedCount:0};let s=(0,r.getDbPool)(),o=await s.connect();try{await o.query("BEGIN");let e=(await o.query(`
        SELECT session_id::text AS session_id
        FROM clinical_sessions
        WHERE patient_pseudonym_id = $1
          AND session_id::text = ANY($2::text[])
      `,[i.patientPseudonymId,a])).rows.map(e=>String(e.session_id));if(!e.length)return await o.query("COMMIT"),{deletedCount:0};return await o.query(`
        DELETE FROM clinical_media_objects
        WHERE patient_pseudonym_id = $1
          AND clinical_session_id::text = ANY($2::text[])
      `,[i.patientPseudonymId,e]),await o.query(`
        DELETE FROM language_training_results
        WHERE patient_pseudonym_id = $1
          AND session_id::text = ANY($2::text[])
      `,[i.patientPseudonymId,e]),await o.query(`
        DELETE FROM sing_results
        WHERE patient_pseudonym_id = $1
          AND session_id::text = ANY($2::text[])
      `,[i.patientPseudonymId,e]),await o.query(`
        DELETE FROM clinical_sessions
        WHERE patient_pseudonym_id = $1
          AND session_id::text = ANY($2::text[])
      `,[i.patientPseudonymId,e]),await o.query("COMMIT"),{deletedCount:e.length}}catch(e){throw await o.query("ROLLBACK"),e}finally{o.release()}}[r,n]=a.then?(await a)():a,e.s(["deleteHistoryEntriesForAuthenticatedUser",()=>u,"getOnboardingStatusForAuthenticatedUser",()=>d,"listHistoryForAuthenticatedUser",()=>o]),i()}catch(e){i(e)}},!1),30167,e=>e.a(async(t,i)=>{try{var r=e.i(93458),n=e.i(89171),a=e.i(32476),s=e.i(87128),o=t([a,s]);async function d(){let e=await (0,r.cookies)(),t=e.get(a.AUTH_COOKIE_NAME)?.value;if(!t)return n.NextResponse.json({ok:!1,error:"unauthorized"},{status:401});try{let e=await (0,s.getOnboardingStatusForAuthenticatedUser)(t);return n.NextResponse.json({ok:!0,...e})}catch(t){let e=t instanceof Error?t.message:"failed_to_load_onboarding_status";return n.NextResponse.json({ok:!1,error:e},{status:"unauthorized"===e?401:500})}}[a,s]=o.then?(await o)():o,e.s(["GET",()=>d,"dynamic",0,"force-dynamic","runtime",0,"nodejs"]),i()}catch(e){i(e)}},!1),17528,e=>e.a(async(t,i)=>{try{var r=e.i(47909),n=e.i(74017),a=e.i(96250),s=e.i(59756),o=e.i(61916),d=e.i(74677),u=e.i(69741),l=e.i(16795),c=e.i(87718),p=e.i(95169),m=e.i(47587),g=e.i(66012),_=e.i(70101),y=e.i(26937),h=e.i(10372),f=e.i(93695);e.i(52474);var S=e.i(220),b=e.i(30167),N=t([b]);[b]=N.then?(await N)():N;let v=new r.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/onboarding/status/route",pathname:"/api/onboarding/status",filename:"route",bundlePath:""},distDir:".next-sandbox3",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/onboarding/status/route.ts",nextConfigOutput:"",userland:b}),{workAsyncStorage:E,workUnitAsyncStorage:x,serverHooks:D}=v;function w(){return(0,a.patchFetch)({workAsyncStorage:E,workUnitAsyncStorage:x})}async function A(e,t,i){v.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let r="/api/onboarding/status/route";r=r.replace(/\/index$/,"")||"/";let a=await v.prepare(e,t,{srcPage:r,multiZoneDraftMode:!1});if(!a)return t.statusCode=400,t.end("Bad Request"),null==i.waitUntil||i.waitUntil.call(i,Promise.resolve()),null;let{buildId:b,params:N,nextConfig:w,parsedUrl:A,isDraftMode:E,prerenderManifest:x,routerServerContext:D,isOnDemandRevalidate:R,revalidateOnlyGenerated:I,resolvedPathname:C,clientReferenceManifest:O,serverActionsManifest:L}=a,U=(0,u.normalizeAppPath)(r),P=!!(x.dynamicRoutes[U]||x.routes[C]),T=async()=>((null==D?void 0:D.render404)?await D.render404(e,t,A,!1):t.end("This page could not be found"),null);if(P&&!E){let e=!!x.routes[C],t=x.dynamicRoutes[U];if(t&&!1===t.fallback&&!e){if(w.experimental.adapterPath)return await T();throw new f.NoFallbackError}}let q=null;!P||v.isDev||E||(q=C,q="/index"===q?"/":q);let k=!0===v.isDev||!P,$=P&&!k;L&&O&&(0,d.setManifestsSingleton)({page:r,clientReferenceManifest:O,serverActionsManifest:L});let j=e.method||"GET",M=(0,o.getTracer)(),z=M.getActiveScopeSpan(),F={params:N,prerenderManifest:x,renderOpts:{experimental:{authInterrupts:!!w.experimental.authInterrupts},cacheComponents:!!w.cacheComponents,supportsDynamicResponse:k,incrementalCache:(0,s.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:w.cacheLife,waitUntil:i.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,i,r,n)=>v.onRequestError(e,t,r,n,D)},sharedContext:{buildId:b}},H=new l.NodeNextRequest(e),W=new l.NodeNextResponse(t),B=c.NextRequestAdapter.fromNodeNextRequest(H,(0,c.signalFromNodeResponse)(t));try{let a=async e=>v.handle(B,F).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let i=M.getRootSpanAttributes();if(!i)return;if(i.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${i.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let n=i.get("next.route");if(n){let t=`${j} ${n}`;e.setAttributes({"next.route":n,"http.route":n,"next.span_name":t}),e.updateName(t)}else e.updateName(`${j} ${r}`)}),d=!!(0,s.getRequestMeta)(e,"minimalMode"),u=async s=>{var o,u;let l=async({previousCacheEntry:n})=>{try{if(!d&&R&&I&&!n)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let r=await a(s);e.fetchMetrics=F.renderOpts.fetchMetrics;let o=F.renderOpts.pendingWaitUntil;o&&i.waitUntil&&(i.waitUntil(o),o=void 0);let u=F.renderOpts.collectedTags;if(!P)return await (0,g.sendResponse)(H,W,r,F.renderOpts.pendingWaitUntil),null;{let e=await r.blob(),t=(0,_.toNodeOutgoingHttpHeaders)(r.headers);u&&(t[h.NEXT_CACHE_TAGS_HEADER]=u),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let i=void 0!==F.renderOpts.collectedRevalidate&&!(F.renderOpts.collectedRevalidate>=h.INFINITE_CACHE)&&F.renderOpts.collectedRevalidate,n=void 0===F.renderOpts.collectedExpire||F.renderOpts.collectedExpire>=h.INFINITE_CACHE?void 0:F.renderOpts.collectedExpire;return{value:{kind:S.CachedRouteKind.APP_ROUTE,status:r.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:i,expire:n}}}}catch(t){throw(null==n?void 0:n.isStale)&&await v.onRequestError(e,t,{routerKind:"App Router",routePath:r,routeType:"route",revalidateReason:(0,m.getRevalidateReason)({isStaticGeneration:$,isOnDemandRevalidate:R})},!1,D),t}},c=await v.handleResponse({req:e,nextConfig:w,cacheKey:q,routeKind:n.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:x,isRoutePPREnabled:!1,isOnDemandRevalidate:R,revalidateOnlyGenerated:I,responseGenerator:l,waitUntil:i.waitUntil,isMinimalMode:d});if(!P)return null;if((null==c||null==(o=c.value)?void 0:o.kind)!==S.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==c||null==(u=c.value)?void 0:u.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});d||t.setHeader("x-nextjs-cache",R?"REVALIDATED":c.isMiss?"MISS":c.isStale?"STALE":"HIT"),E&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let p=(0,_.fromNodeOutgoingHttpHeaders)(c.value.headers);return d&&P||p.delete(h.NEXT_CACHE_TAGS_HEADER),!c.cacheControl||t.getHeader("Cache-Control")||p.get("Cache-Control")||p.set("Cache-Control",(0,y.getCacheControlHeader)(c.cacheControl)),await (0,g.sendResponse)(H,W,new Response(c.value.body,{headers:p,status:c.value.status||200})),null};z?await u(z):await M.withPropagatedContext(e.headers,()=>M.trace(p.BaseServerSpan.handleRequest,{spanName:`${j} ${r}`,kind:o.SpanKind.SERVER,attributes:{"http.method":j,"http.target":e.url}},u))}catch(t){if(t instanceof f.NoFallbackError||await v.onRequestError(e,t,{routerKind:"App Router",routePath:U,routeType:"route",revalidateReason:(0,m.getRevalidateReason)({isStaticGeneration:$,isOnDemandRevalidate:R})},!1,D),P)throw t;return await (0,g.sendResponse)(H,W,new Response(null,{status:500})),null}}e.s(["handler",()=>A,"patchFetch",()=>w,"routeModule",()=>v,"serverHooks",()=>D,"workAsyncStorage",()=>E,"workUnitAsyncStorage",()=>x]),i()}catch(e){i(e)}},!1)];

//# sourceMappingURL=%5Broot-of-the-server%5D__8a1a25e1._.js.map