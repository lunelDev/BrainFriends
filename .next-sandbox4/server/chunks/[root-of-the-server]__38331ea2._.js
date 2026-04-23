module.exports=[70406,(e,t,a)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,a)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},23862,e=>e.a(async(t,a)=>{try{let t=await e.y("pg-587764f78a6c7a9c");e.n(t),a()}catch(e){a(e)}},!0),63528,e=>e.a(async(t,a)=>{try{var i=e.i(23862),n=t([i]);[i]=n.then?(await n)():n;let o=process.env.DATABASE_URL;function r(){if(!o)throw Error("missing_database_url");return global.__brainfriendsPgPool||(global.__brainfriendsPgPool=new i.Pool({connectionString:o,ssl:"require"===process.env.DATABASE_SSL&&{rejectUnauthorized:!1}})),global.__brainfriendsPgPool}o||console.warn("[db] DATABASE_URL is not configured. Database writes are disabled."),e.s(["getDbPool",()=>r]),a()}catch(e){a(e)}},!1),77545,e=>e.a(async(t,a)=>{try{var i=e.i(54799),n=e.i(63528),r=t([n]);function o(e){return(0,i.createHash)("sha256").update(e).digest("hex")}function s(e){let t=o(e).slice(0,32).split("");t[12]="5",t[16]=(3&parseInt(t[16],16)|8).toString(16);let a=t.join("");return`${a.slice(0,8)}-${a.slice(8,12)}-${a.slice(12,16)}-${a.slice(16,20)}-${a.slice(20,32)}`}function u(e){return[e.name.trim(),e.birthDate??"",e.gender,e.phone??"",e.language??"ko"].join("|")}function l(e){let t=u(e);return`psn_${o(t).slice(0,24)}`}async function c(e,t){let a=u(t),i=s(`patient:${a}`),n=`PT-${i.slice(0,8).toUpperCase()}`,r=l(t);return await e.query(`
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
    `,[i,n,t.name.trim(),t.birthDate||null,t.gender||"U",t.phone||null,t.language||"ko"]),await e.query(`
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
    `,[r,i,"pseudonym-map-v1"]),{patientId:i,patientCode:n,patientPseudonymId:r}}async function d(e){let t=(0,n.getDbPool)(),a=await t.connect();try{await a.query("BEGIN");let t=await c(a,e);return await a.query("COMMIT"),t}catch(e){throw await a.query("ROLLBACK"),e}finally{a.release()}}[n]=r.then?(await r)():r,e.s(["buildPatientPseudonymId",()=>l,"deterministicUuid",()=>s,"ensurePatientIdentity",()=>d,"hashValue",()=>o,"upsertPatientIdentity",()=>c]),a()}catch(e){a(e)}},!1),66680,(e,t,a)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},24868,(e,t,a)=>{t.exports=e.x("fs/promises",()=>require("fs/promises"))},12714,(e,t,a)=>{t.exports=e.x("node:fs/promises",()=>require("node:fs/promises"))},18622,(e,t,a)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},14747,(e,t,a)=>{t.exports=e.x("path",()=>require("path"))},54799,(e,t,a)=>{t.exports=e.x("crypto",()=>require("crypto"))},50227,(e,t,a)=>{t.exports=e.x("node:path",()=>require("node:path"))},57342,e=>{"use strict";var t=e.i(24868),a=e.i(14747),i=e.i(54799);let n=a.default.join(process.cwd(),"data","organizations"),r=a.default.join(n,"registration-requests.json");async function o(){await (0,t.mkdir)(n,{recursive:!0})}function s(e){let{businessLicenseFileDataUrl:t,adminPasswordHash:a,...i}=e;return i}async function u(){await o();try{let e=await (0,t.readFile)(r,"utf8"),a=JSON.parse(e);return Array.isArray(a)?a:[]}catch{return[]}}async function l(e){await o(),await (0,t.writeFile)(r,JSON.stringify(e,null,2),"utf8")}function c(e){return String(e??"").replace(/[^\d-]/g,"").trim()}function d(e){return String(e??"").trim().toLowerCase()}async function p(){return(await u()).sort((e,t)=>e.createdAt<t.createdAt?1:-1).map(s)}async function m(e){let t,a={id:i.default.randomUUID(),organizationName:String(e.organizationName??"").trim(),businessNumber:(t=(e.businessNumber??"").replace(/\D/g,"").slice(0,10)).length<=3?t:t.length<=5?`${t.slice(0,3)}-${t.slice(3)}`:`${t.slice(0,3)}-${t.slice(3,5)}-${t.slice(5,10)}`,representativeName:String(e.representativeName??"").trim(),organizationType:String(e.organizationType??"").trim(),openedDate:function(e){let t=String(e??"").trim();if(t){if(Number.isNaN(new Date(t).getTime()))throw Error("invalid_request_payload");return t}}(e.openedDate),businessLicenseFileName:String(e.businessLicenseFileName??"").trim(),businessLicenseFileDataUrl:String(e.businessLicenseFileDataUrl??"").trim()||void 0,careInstitutionNumber:String(e.careInstitutionNumber??"").trim(),medicalInstitutionCode:String(e.medicalInstitutionCode??"").trim()||void 0,medicalDepartments:String(e.medicalDepartments??"").trim()||void 0,bedCount:"number"==typeof e.bedCount&&Number.isFinite(e.bedCount)?e.bedCount:void 0,organizationPhone:c(e.organizationPhone??""),postalCode:String(e.postalCode??"").trim(),roadAddress:String(e.roadAddress??"").trim(),addressDetail:String(e.addressDetail??"").trim(),contactName:String(e.contactName??"").trim(),contactTitle:String(e.contactTitle??"").trim()||void 0,contactPhone:c(e.contactPhone??""),contactEmail:d(e.contactEmail??""),adminLoginEmail:d(e.adminLoginEmail??"")||void 0,adminPasswordHash:function(e){let t=String(e??"").trim();if(t)return i.default.createHash("sha256").update(t).digest("hex")}(e.adminPassword),twoFactorMethod:"sms"===e.twoFactorMethod?"sms":void 0,billingEmail:d(e.billingEmail??"")||void 0,bankName:String(e.bankName??"").trim()||void 0,bankAccountNumber:String(e.bankAccountNumber??"").trim()||void 0,bankAccountHolder:String(e.bankAccountHolder??"").trim()||void 0,servicePurpose:String(e.servicePurpose??"").trim()||void 0,targetPatients:String(e.targetPatients??"").trim()||void 0,doctorName:String(e.doctorName??"").trim()||void 0,doctorLicenseNumber:String(e.doctorLicenseNumber??"").trim()||void 0,irbStatus:"planned"===e.irbStatus||"approved"===e.irbStatus?e.irbStatus:void 0,termsAgreed:!!e.termsAgreed,privacyAgreed:!!e.privacyAgreed,medicalDataAgreed:!!e.medicalDataAgreed,contractAgreed:!!e.contractAgreed,patientDataAgreed:!!e.patientDataAgreed,status:"pending",createdAt:new Date().toISOString()};if([!!a.organizationName,!!a.businessNumber,!!a.representativeName,!!a.organizationType,!!a.businessLicenseFileName,!!a.careInstitutionNumber,!!a.contactName,!!a.contactEmail,!!a.contactPhone,a.termsAgreed,a.privacyAgreed,a.medicalDataAgreed].some(e=>!e))throw Error("invalid_request_payload");let n=await u();if(n.find(e=>e.organizationName===a.organizationName||e.businessNumber===a.businessNumber||e.careInstitutionNumber===a.careInstitutionNumber))throw Error("organization_already_exists");return n.unshift(a),await l(n),s(a)}async function g(e){let t=await u(),a=t.findIndex(t=>t.id===e.requestId);if(a<0)throw Error("request_not_found");let i=t[a];if("pending"!==i.status)throw Error("request_already_reviewed");let n={...i,status:e.status,reviewedAt:new Date().toISOString(),reviewedBy:String(e.reviewerLoginId??"").trim()||void 0};return t[a]=n,await l(t),s(n)}e.s(["createOrganizationRegistrationRequest",()=>m,"listOrganizationRegistrationRequests",()=>p,"reviewOrganizationRegistrationRequest",()=>g])},92768,e=>{"use strict";var t=e.i(12714),a=e.i(50227),i=e.i(66680);let n=[];var r=e.i(57342);let o=a.default.join(process.cwd(),"data","organizations"),s=a.default.join(o,"manual-organizations.json");async function u(){await (0,t.mkdir)(o,{recursive:!0})}async function l(){await u();try{let e=await (0,t.readFile)(s,"utf8"),a=JSON.parse(e);return Array.isArray(a)?a:[]}catch(e){if("ENOENT"===(e&&"object"==typeof e&&"code"in e?String(e.code):""))return[];throw e}}async function c(e){await u(),await (0,t.writeFile)(s,JSON.stringify(e,null,2),"utf8")}async function d(){let e=await l();return[...n.map(e=>({...e,source:"builtin"})),...e.map(e=>({...e,source:"manual"}))]}async function p(e){return(await d()).find(t=>t.id===e)??null}async function m(e){let t=String(e.name??"").trim(),a=String(e.businessNumber??"").trim(),i=String(e.careInstitutionNumber??"").trim();if(!t&&!a&&!i)return null;for(let e of(await d())){if(t&&e.name===t)return{source:"manual",field:"name",existingId:e.id};let n=e.businessNumber?.trim();if(a&&n&&n===a)return{source:"manual",field:"businessNumber",existingId:e.id};let r=e.careInstitutionNumber?.trim();if(i&&r&&r===i)return{source:"manual",field:"careInstitutionNumber",existingId:e.id}}for(let e of(await (0,r.listOrganizationRegistrationRequests)()))if("pending"===e.status){if(t&&e.organizationName===t)return{source:"request",field:"name",existingId:e.id};if(a&&e.businessNumber===a)return{source:"request",field:"businessNumber",existingId:e.id};if(i&&e.careInstitutionNumber===i)return{source:"request",field:"careInstitutionNumber",existingId:e.id}}return null}async function g(e){let t=String(e??"").trim();return t?(await d()).find(e=>e.name===t)??null:null}async function v(e){let t,a=e.name.trim(),n=e.address.trim();if(!a||!n)throw Error("invalid_organization_payload");let r=await l();if(r.find(t=>t.name===a||t.businessNumber===e.businessNumber))throw Error("organization_already_exists");let o={id:(0,i.randomUUID)(),code:(t=a.replace(/\s+/g,"").slice(0,8).toUpperCase(),`ORG-${t||"CUSTOM"}-${Date.now().toString().slice(-6)}`),name:a,address:n,businessNumber:String(e.businessNumber??"").trim()||void 0,representativeName:String(e.representativeName??"").trim()||void 0,organizationPhone:String(e.organizationPhone??"").trim()||void 0,organizationType:String(e.organizationType??"").trim()||void 0,careInstitutionNumber:String(e.careInstitutionNumber??"").trim()||void 0,medicalInstitutionCode:String(e.medicalInstitutionCode??"").trim()||void 0,medicalDepartments:String(e.medicalDepartments??"").trim()||void 0,postalCode:String(e.postalCode??"").trim()||void 0,roadAddress:String(e.roadAddress??"").trim()||void 0,addressDetail:String(e.addressDetail??"").trim()||void 0,contactName:String(e.contactName??"").trim()||void 0,contactTitle:String(e.contactTitle??"").trim()||void 0,contactPhone:String(e.contactPhone??"").trim()||void 0,contactEmail:String(e.contactEmail??"").trim()||void 0,adminLoginEmail:String(e.adminLoginEmail??"").trim()||void 0,twoFactorMethod:e.twoFactorMethod,servicePurpose:String(e.servicePurpose??"").trim()||void 0,targetPatients:String(e.targetPatients??"").trim()||void 0,doctorName:String(e.doctorName??"").trim()||void 0,doctorLicenseNumber:String(e.doctorLicenseNumber??"").trim()||void 0,createdAt:new Date().toISOString(),source:"manual"};return r.unshift(o),await c(r),o}e.s(["createManagedOrganization",()=>v,"findApprovedOrganizationByName",()=>g,"findOrganizationDuplicate",()=>m,"getAvailableOrganizationById",()=>p,"listAvailableOrganizations",()=>d],92768)},23722,e=>e.a(async(t,a)=>{try{var i=e.i(24868),n=e.i(14747),r=e.i(63528),o=e.i(77545),s=t([r,o]);async function u(e){await e.query(`
    CREATE TABLE IF NOT EXISTS ai_evaluation_samples (
      sample_id uuid PRIMARY KEY,
      source_history_id text NOT NULL,
      source_session_id text NOT NULL,
      patient_pseudonym_id text NOT NULL,
      training_mode text NOT NULL,
      rehab_step integer NULL,
      utterance_id text NOT NULL,
      quality text NOT NULL,
      prompt_text text NOT NULL,
      transcript_text text NOT NULL,
      consonant_accuracy double precision NOT NULL DEFAULT 0,
      vowel_accuracy double precision NOT NULL DEFAULT 0,
      pronunciation_score double precision NOT NULL DEFAULT 0,
      symmetry_score double precision NOT NULL DEFAULT 0,
      tracking_quality double precision NOT NULL DEFAULT 0,
      processing_ms double precision NOT NULL DEFAULT 0,
      fps double precision NOT NULL DEFAULT 0,
      model_version text NOT NULL,
      analysis_version text NOT NULL,
      evaluation_dataset_version text NOT NULL,
      captured_at timestamptz NOT NULL,
      governance jsonb NULL,
      sample_payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      UNIQUE (source_history_id, utterance_id)
    )
  `)}async function l(e){let t=n.default.join(process.cwd(),"data","evaluation"),a=n.default.join(t,"evaluation-samples.ndjson");await (0,i.mkdir)(t,{recursive:!0});let r=e.samples.map(t=>JSON.stringify({historyId:e.historyId,sessionId:e.sessionId,governance:e.governance??null,sample:t,recordedAt:new Date().toISOString()}));return await (0,i.appendFile)(a,`${r.join("\n")}
`,"utf8"),{accepted:e.samples.length,storageTarget:"file",path:a}}async function c(e){let t=(0,r.getDbPool)(),a=await t.connect();try{for(let t of(await a.query("BEGIN"),await u(a),e.samples))await a.query(`
          INSERT INTO ai_evaluation_samples (
            sample_id,
            source_history_id,
            source_session_id,
            patient_pseudonym_id,
            training_mode,
            rehab_step,
            utterance_id,
            quality,
            prompt_text,
            transcript_text,
            consonant_accuracy,
            vowel_accuracy,
            pronunciation_score,
            symmetry_score,
            tracking_quality,
            processing_ms,
            fps,
            model_version,
            analysis_version,
            evaluation_dataset_version,
            captured_at,
            governance,
            sample_payload,
            updated_at
          )
          VALUES (
            $1::uuid,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            $17,
            $18,
            $19,
            $20,
            $21::timestamptz,
            $22::jsonb,
            $23::jsonb,
            NOW()
          )
          ON CONFLICT (source_history_id, utterance_id) DO UPDATE
          SET
            source_session_id = EXCLUDED.source_session_id,
            patient_pseudonym_id = EXCLUDED.patient_pseudonym_id,
            training_mode = EXCLUDED.training_mode,
            rehab_step = EXCLUDED.rehab_step,
            quality = EXCLUDED.quality,
            prompt_text = EXCLUDED.prompt_text,
            transcript_text = EXCLUDED.transcript_text,
            consonant_accuracy = EXCLUDED.consonant_accuracy,
            vowel_accuracy = EXCLUDED.vowel_accuracy,
            pronunciation_score = EXCLUDED.pronunciation_score,
            symmetry_score = EXCLUDED.symmetry_score,
            tracking_quality = EXCLUDED.tracking_quality,
            processing_ms = EXCLUDED.processing_ms,
            fps = EXCLUDED.fps,
            model_version = EXCLUDED.model_version,
            analysis_version = EXCLUDED.analysis_version,
            evaluation_dataset_version = EXCLUDED.evaluation_dataset_version,
            captured_at = EXCLUDED.captured_at,
            governance = EXCLUDED.governance,
            sample_payload = EXCLUDED.sample_payload,
            updated_at = NOW()
        `,[(0,o.deterministicUuid)(`evaluation-sample:${t.historyId}:${t.utteranceId}:${t.evaluationDatasetVersion}`),e.historyId,e.sessionId,`eval_${(0,o.hashValue)(`patient:${t.patientId}`).slice(0,24)}`,t.trainingMode,t.rehabStep,t.utteranceId,t.quality,t.prompt,t.transcript,t.consonantAccuracy,t.vowelAccuracy,t.pronunciationScore,t.symmetryScore,t.trackingQuality,t.processingMs,t.fps,t.modelVersion,t.analysisVersion,t.evaluationDatasetVersion,t.capturedAt,e.governance?JSON.stringify(e.governance):null,JSON.stringify(t)]);return await a.query("COMMIT"),{accepted:e.samples.length,storageTarget:"database"}}catch(e){throw await a.query("ROLLBACK"),e}finally{a.release()}}async function d(){let e=(0,r.getDbPool)(),t=await e.connect();try{await u(t);let[e,a,i,n]=await Promise.all([t.query(`
        SELECT
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (WHERE quality = 'measured')::int AS measured_count,
          MAX(captured_at)::text AS latest_captured_at
        FROM ai_evaluation_samples
      `),t.query(`
        SELECT
          evaluation_dataset_version,
          model_version,
          analysis_version,
          COUNT(*)::int AS sample_count,
          MAX(captured_at)::text AS latest_captured_at,
          AVG(pronunciation_score)::double precision AS avg_pronunciation_score,
          AVG(consonant_accuracy)::double precision AS avg_consonant_accuracy,
          AVG(vowel_accuracy)::double precision AS avg_vowel_accuracy,
          AVG(tracking_quality)::double precision AS avg_tracking_quality
        FROM ai_evaluation_samples
        GROUP BY evaluation_dataset_version, model_version, analysis_version
        ORDER BY latest_captured_at DESC NULLS LAST
        LIMIT 10
      `),t.query(`
        SELECT
          training_mode,
          COUNT(*)::int AS sample_count
        FROM ai_evaluation_samples
        GROUP BY training_mode
        ORDER BY sample_count DESC, training_mode ASC
      `),t.query(`
        SELECT
          quality,
          COUNT(*)::int AS sample_count
        FROM ai_evaluation_samples
        GROUP BY quality
        ORDER BY sample_count DESC, quality ASC
      `)]),r=e.rows[0]??{},o=a.rows.map(e=>({evaluationDatasetVersion:String(e.evaluation_dataset_version),modelVersion:String(e.model_version),analysisVersion:String(e.analysis_version),sampleCount:Number(e.sample_count??0),latestCapturedAt:e.latest_captured_at?String(e.latest_captured_at):null,avgPronunciationScore:Number(e.avg_pronunciation_score??0),avgConsonantAccuracy:Number(e.avg_consonant_accuracy??0),avgVowelAccuracy:Number(e.avg_vowel_accuracy??0),avgTrackingQuality:Number(e.avg_tracking_quality??0)})),s=o[0]??null,l=o[1]??null;return{totalCount:Number(r.total_count??0),measuredCount:Number(r.measured_count??0),latestCapturedAt:r.latest_captured_at?String(r.latest_captured_at):null,versions:o,latestVersionComparison:s&&l?{current:s,previous:l,sampleDelta:s.sampleCount-l.sampleCount,pronunciationDelta:s.avgPronunciationScore-l.avgPronunciationScore,consonantDelta:s.avgConsonantAccuracy-l.avgConsonantAccuracy,vowelDelta:s.avgVowelAccuracy-l.avgVowelAccuracy,trackingDelta:s.avgTrackingQuality-l.avgTrackingQuality}:null,modeBreakdown:i.rows.map(e=>({trainingMode:String(e.training_mode),sampleCount:Number(e.sample_count??0)})),qualityBreakdown:n.rows.map(e=>({quality:String(e.quality),sampleCount:Number(e.sample_count??0)}))}}finally{t.release()}}[r,o]=s.then?(await s)():s,e.s(["appendEvaluationSamplesToFile",()=>l,"getEvaluationSamplesSummary",()=>d,"saveEvaluationSamplesToDatabase",()=>c]),a()}catch(e){a(e)}},!1),12259,e=>e.a(async(t,a)=>{try{var i=e.i(23722),n=t([i]);async function r(){let e=await (0,i.getEvaluationSamplesSummary)(),t={documentControl:{documentType:"AI Evaluation Evidence Package",generatedAt:new Date().toISOString(),productName:"BrainFriends",exportFileName:"brainfriends-ai-evaluation-report.json"},executionSummary:{totalSamples:e.totalCount,measuredSamples:e.measuredCount,latestCapturedAt:e.latestCapturedAt,versionCombinationCount:e.versions.length},storagePolicy:{primaryStorage:"PostgreSQL ai_evaluation_samples",fallbackStorage:"data/evaluation/evaluation-samples.ndjson",inclusionRule:"quality=measured and transcript/version fields present"},operatingView:{systemPage:"/therapist/system",evaluationPage:"/therapist/system/evaluation"}},a={versionComparisonTable:e.versions.map(e=>({evaluationDatasetVersion:e.evaluationDatasetVersion,modelVersion:e.modelVersion,analysisVersion:e.analysisVersion,sampleCount:e.sampleCount,latestCapturedAt:e.latestCapturedAt,avgPronunciationScore:Number(e.avgPronunciationScore.toFixed(2)),avgConsonantAccuracy:Number(e.avgConsonantAccuracy.toFixed(2)),avgVowelAccuracy:Number(e.avgVowelAccuracy.toFixed(2)),avgTrackingQuality:Number(e.avgTrackingQuality.toFixed(3))})),latestVersionDeltaTable:e.latestVersionComparison?{currentVersion:{evaluationDatasetVersion:e.latestVersionComparison.current.evaluationDatasetVersion,modelVersion:e.latestVersionComparison.current.modelVersion,analysisVersion:e.latestVersionComparison.current.analysisVersion},previousVersion:{evaluationDatasetVersion:e.latestVersionComparison.previous.evaluationDatasetVersion,modelVersion:e.latestVersionComparison.previous.modelVersion,analysisVersion:e.latestVersionComparison.previous.analysisVersion},sampleDelta:e.latestVersionComparison.sampleDelta,pronunciationDelta:Number(e.latestVersionComparison.pronunciationDelta.toFixed(2)),consonantDelta:Number(e.latestVersionComparison.consonantDelta.toFixed(2)),vowelDelta:Number(e.latestVersionComparison.vowelDelta.toFixed(2)),trackingDelta:Number(e.latestVersionComparison.trackingDelta.toFixed(3))}:null,modeBreakdownTable:e.modeBreakdown.map(e=>({trainingMode:e.trainingMode,sampleCount:e.sampleCount})),qualityBreakdownTable:e.qualityBreakdown.map(e=>({quality:e.quality,sampleCount:e.sampleCount}))};return{exportType:"brainfriends-ai-evaluation-report",generatedAt:new Date().toISOString(),submissionEnvelope:t,summary:e,submissionTables:a}}[i]=n.then?(await n)():n,e.s(["buildAiEvaluationEvidenceSummary",()=>r]),a()}catch(e){a(e)}},!1),33031,e=>e.a(async(t,a)=>{try{var i=e.i(93458),n=e.i(89171),r=e.i(32476),o=e.i(12259),s=t([r,o]);async function u(){var e;let t=await (0,i.cookies)(),a=t.get(r.AUTH_COOKIE_NAME)?.value;if(!a)return n.NextResponse.json({ok:!1,error:"unauthorized"},{status:401});let s=await (0,r.getAuthenticatedSessionContext)(a);if(!s)return n.NextResponse.json({ok:!1,error:"unauthorized"},{status:401});if(e=s.userRole,"admin"!==e&&"therapist"!==e)return n.NextResponse.json({ok:!1,error:"forbidden"},{status:403});let u=await (0,o.buildAiEvaluationEvidenceSummary)();return new n.NextResponse(JSON.stringify(u,null,2),{status:200,headers:{"Content-Type":"application/json; charset=utf-8","Content-Disposition":'attachment; filename="brainfriends-ai-evaluation-report.json"'}})}[r,o]=s.then?(await s)():s,e.s(["GET",()=>u,"dynamic",0,"force-dynamic","runtime",0,"nodejs"]),a()}catch(e){a(e)}},!1),7927,e=>e.a(async(t,a)=>{try{var i=e.i(47909),n=e.i(74017),r=e.i(96250),o=e.i(59756),s=e.i(61916),u=e.i(74677),l=e.i(69741),c=e.i(16795),d=e.i(87718),p=e.i(95169),m=e.i(47587),g=e.i(66012),v=e.i(70101),_=e.i(26937),y=e.i(10372),N=e.i(93695);e.i(52474);var E=e.i(220),b=e.i(33031),f=t([b]);[b]=f.then?(await f)():f;let w=new i.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/therapist/system/ai-evaluation-export/route",pathname:"/api/therapist/system/ai-evaluation-export",filename:"route",bundlePath:""},distDir:".next-sandbox4",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/therapist/system/ai-evaluation-export/route.ts",nextConfigOutput:"",userland:b}),{workAsyncStorage:D,workUnitAsyncStorage:C,serverHooks:A}=w;function h(){return(0,r.patchFetch)({workAsyncStorage:D,workUnitAsyncStorage:C})}async function S(e,t,a){w.isDev&&(0,o.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let i="/api/therapist/system/ai-evaluation-export/route";i=i.replace(/\/index$/,"")||"/";let r=await w.prepare(e,t,{srcPage:i,multiZoneDraftMode:!1});if(!r)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:b,params:f,nextConfig:h,parsedUrl:S,isDraftMode:D,prerenderManifest:C,routerServerContext:A,isOnDemandRevalidate:x,revalidateOnlyGenerated:L,resolvedPathname:T,clientReferenceManifest:O,serverActionsManifest:U}=r,R=(0,l.normalizeAppPath)(i),I=!!(C.dynamicRoutes[R]||C.routes[T]),q=async()=>((null==A?void 0:A.render404)?await A.render404(e,t,S,!1):t.end("This page could not be found"),null);if(I&&!D){let e=!!C.routes[T],t=C.dynamicRoutes[R];if(t&&!1===t.fallback&&!e){if(h.experimental.adapterPath)return await q();throw new N.NoFallbackError}}let P=null;!I||w.isDev||D||(P=T,P="/index"===P?"/":P);let $=!0===w.isDev||!I,k=I&&!$;U&&O&&(0,u.setManifestsSingleton)({page:i,clientReferenceManifest:O,serverActionsManifest:U});let V=e.method||"GET",F=(0,s.getTracer)(),j=F.getActiveScopeSpan(),z={params:f,prerenderManifest:C,renderOpts:{experimental:{authInterrupts:!!h.experimental.authInterrupts},cacheComponents:!!h.cacheComponents,supportsDynamicResponse:$,incrementalCache:(0,o.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:h.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,i,n)=>w.onRequestError(e,t,i,n,A)},sharedContext:{buildId:b}},M=new c.NodeNextRequest(e),X=new c.NodeNextResponse(t),B=d.NextRequestAdapter.fromNodeNextRequest(M,(0,d.signalFromNodeResponse)(t));try{let r=async e=>w.handle(B,z).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=F.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let n=a.get("next.route");if(n){let t=`${V} ${n}`;e.setAttributes({"next.route":n,"http.route":n,"next.span_name":t}),e.updateName(t)}else e.updateName(`${V} ${i}`)}),u=!!(0,o.getRequestMeta)(e,"minimalMode"),l=async o=>{var s,l;let c=async({previousCacheEntry:n})=>{try{if(!u&&x&&L&&!n)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let i=await r(o);e.fetchMetrics=z.renderOpts.fetchMetrics;let s=z.renderOpts.pendingWaitUntil;s&&a.waitUntil&&(a.waitUntil(s),s=void 0);let l=z.renderOpts.collectedTags;if(!I)return await (0,g.sendResponse)(M,X,i,z.renderOpts.pendingWaitUntil),null;{let e=await i.blob(),t=(0,v.toNodeOutgoingHttpHeaders)(i.headers);l&&(t[y.NEXT_CACHE_TAGS_HEADER]=l),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==z.renderOpts.collectedRevalidate&&!(z.renderOpts.collectedRevalidate>=y.INFINITE_CACHE)&&z.renderOpts.collectedRevalidate,n=void 0===z.renderOpts.collectedExpire||z.renderOpts.collectedExpire>=y.INFINITE_CACHE?void 0:z.renderOpts.collectedExpire;return{value:{kind:E.CachedRouteKind.APP_ROUTE,status:i.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:n}}}}catch(t){throw(null==n?void 0:n.isStale)&&await w.onRequestError(e,t,{routerKind:"App Router",routePath:i,routeType:"route",revalidateReason:(0,m.getRevalidateReason)({isStaticGeneration:k,isOnDemandRevalidate:x})},!1,A),t}},d=await w.handleResponse({req:e,nextConfig:h,cacheKey:P,routeKind:n.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:C,isRoutePPREnabled:!1,isOnDemandRevalidate:x,revalidateOnlyGenerated:L,responseGenerator:c,waitUntil:a.waitUntil,isMinimalMode:u});if(!I)return null;if((null==d||null==(s=d.value)?void 0:s.kind)!==E.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(l=d.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});u||t.setHeader("x-nextjs-cache",x?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),D&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let p=(0,v.fromNodeOutgoingHttpHeaders)(d.value.headers);return u&&I||p.delete(y.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||p.get("Cache-Control")||p.set("Cache-Control",(0,_.getCacheControlHeader)(d.cacheControl)),await (0,g.sendResponse)(M,X,new Response(d.value.body,{headers:p,status:d.value.status||200})),null};j?await l(j):await F.withPropagatedContext(e.headers,()=>F.trace(p.BaseServerSpan.handleRequest,{spanName:`${V} ${i}`,kind:s.SpanKind.SERVER,attributes:{"http.method":V,"http.target":e.url}},l))}catch(t){if(t instanceof N.NoFallbackError||await w.onRequestError(e,t,{routerKind:"App Router",routePath:R,routeType:"route",revalidateReason:(0,m.getRevalidateReason)({isStaticGeneration:k,isOnDemandRevalidate:x})},!1,A),I)throw t;return await (0,g.sendResponse)(M,X,new Response(null,{status:500})),null}}e.s(["handler",()=>S,"patchFetch",()=>h,"routeModule",()=>w,"serverHooks",()=>A,"workAsyncStorage",()=>D,"workUnitAsyncStorage",()=>C]),a()}catch(e){a(e)}},!1)];

//# sourceMappingURL=%5Broot-of-the-server%5D__38331ea2._.js.map