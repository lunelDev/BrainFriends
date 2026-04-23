module.exports=[79639,e=>e.a(async(t,i)=>{try{var s=e.i(32476),a=e.i(63528),n=t([s,a]);function r(e){if("string"!=typeof e)return!1;let t=e.trim();return!!t&&(t.startsWith("data:audio/")||t.startsWith("blob:")||t.startsWith("/api/media/access?")||/^https?:\/\//i.test(t))}async function o(e){if(!await (0,s.getAuthenticatedSessionContext)(e))throw Error("unauthorized");let t=(0,a.getDbPool)(),i=await t.connect();try{let e=await i.query(`
        SELECT
          to_regclass('public.therapist_patient_assignments') IS NOT NULL AS has_assignments,
          to_regclass('public.patient_intake_profiles')       IS NOT NULL AS has_intake,
          to_regclass('public.organizations')                 IS NOT NULL AS has_organizations
      `),t=!!e.rows[0]?.has_assignments,s=!!e.rows[0]?.has_intake,a=!!e.rows[0]?.has_organizations,n=t?`
          tpii.full_name AS therapist_name,
          tu.login_id    AS therapist_login_id,
          tu.user_id::text AS therapist_user_id,
          ${a?"torg.organization_name":"NULL::text"} AS therapist_organization_name,
      `:`
          NULL::text AS therapist_name,
          NULL::text AS therapist_login_id,
          NULL::text AS therapist_user_id,
          NULL::text AS therapist_organization_name,
      `,r=t?`
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
          ${a?"LEFT JOIN organizations torg ON torg.organization_id = tu.organization_id":""}
      `:"",o=s?`
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
      `;return(await i.query(`
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
          ${o}
          ${n}
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
        ${s?"LEFT JOIN patient_intake_profiles pip ON pip.patient_id = pii.patient_id":""}
        ${r}
        ORDER BY latest_activity_at DESC NULLS LAST, pii.created_at DESC
      `)).rows.map(e=>{let t="string"==typeof e.sex?e.sex.trim().toUpperCase():"",i="string"==typeof e.hemiplegia?e.hemiplegia.trim().toUpperCase():"",s="string"==typeof e.hemianopsia?e.hemianopsia.trim().toUpperCase():"";return{patientId:String(e.patient_id),patientPseudonymId:String(e.patient_pseudonym_id),patientName:String(e.full_name),patientCode:String(e.patient_code),loginId:e.login_id?String(e.login_id):null,birthDate:e.birth_date?String(e.birth_date):null,phone:e.phone?String(e.phone):null,sex:"M"===t||"F"===t||"U"===t?t:null,educationYears:null==e.education_years?null:Number(e.education_years),onsetDate:e.onset_date?String(e.onset_date):null,daysSinceOnset:null==e.days_since_onset?null:Number(e.days_since_onset),hemiplegia:"Y"===i||"N"===i?i:null,hemianopsia:"LEFT"===s||"RIGHT"===s||"NONE"===s?s:null,hand:e.hand?String(e.hand):null,latestActivityAt:e.latest_activity_at?String(e.latest_activity_at):null,createdAt:e.created_at?String(e.created_at):null,selfAssessmentCount:Number(e.self_assessment_count??0),rehabCount:Number(e.rehab_count??0),singCount:Number(e.sing_count??0),therapistName:e.therapist_name?String(e.therapist_name):null,therapistLoginId:e.therapist_login_id?String(e.therapist_login_id):null,therapistUserId:e.therapist_user_id?String(e.therapist_user_id):null,therapistOrganizationName:e.therapist_organization_name?String(e.therapist_organization_name):null}})}finally{i.release()}}function _(e,t,i){let s=String(e.patient_pseudonym_id);return[...t.map(t=>{let i=t.step_details&&"object"==typeof t.step_details?t.step_details:{};return{historyId:t.source_history_id?String(t.source_history_id):String(t.result_id),sessionId:String(t.session_id),patientKey:s,patientName:String(e.full_name),birthDate:e.birth_date?String(e.birth_date):"",age:0,educationYears:0,place:"home",trainingMode:"rehab"===t.training_mode?"rehab":"self",rehabStep:null==t.rehab_step?void 0:Number(t.rehab_step),completedAt:new Date(t.completed_at).getTime(),aq:Number(t.aq??0),stepScores:t.step_scores??{step1:0,step2:0,step3:0,step4:0,step5:0,step6:0},stepDetails:{step1:Array.isArray(i.step1)?i.step1:[],step2:Array.isArray(i.step2)?i.step2:[],step3:Array.isArray(i.step3)?i.step3:[],step4:Array.isArray(i.step4)?i.step4:[],step5:Array.isArray(i.step5)?i.step5:[],step6:Array.isArray(i.step6)?i.step6:[]},articulationScores:t.articulation_scores??void 0,facialAnalysisSnapshot:t.facial_analysis_snapshot??void 0,measurementQuality:t.measurement_quality??void 0,stepVersionSnapshots:t.step_version_snapshots??void 0,vnv:i.__meta?.vnv??void 0}}),...i.map(t=>({historyId:`history_sing_${String(t.result_id??new Date(t.completed_at).getTime())}`,sessionId:String(t.session_id),patientKey:s,patientName:String(e.full_name),birthDate:e.birth_date?String(e.birth_date):"",age:0,educationYears:0,place:"brain-sing",trainingMode:"sing",completedAt:new Date(t.completed_at).getTime(),aq:Number(t.score??0),singResult:{song:String(t.song_key),score:Number(t.score??0),finalJitter:null==t.jitter?"-":String(t.jitter),finalSi:null==t.facial_symmetry?"-":String(t.facial_symmetry),rtLatency:null==t.latency_ms?"-":String(t.latency_ms),finalConsonant:null==t.consonant_accuracy?"-":String(t.consonant_accuracy),finalVowel:null==t.vowel_accuracy?"-":String(t.vowel_accuracy),lyricAccuracy:null==t.lyric_accuracy?"-":String(t.lyric_accuracy),transcript:null==t.recognized_lyrics?"":String(t.recognized_lyrics),comment:t.comment?String(t.comment):"",rankings:[],versionSnapshot:t.version_snapshot??void 0},stepScores:{step1:0,step2:0,step3:0,step4:0,step5:0,step6:0},stepDetails:{step1:[],step2:[],step3:[],step4:[],step5:[],step6:[]}}))].sort((e,t)=>t.completedAt-e.completedAt)}async function p(e){if(!await (0,s.getAuthenticatedSessionContext)(e))throw Error("unauthorized");let t=(0,a.getDbPool)(),[i,n,r]=await Promise.all([t.query(`
        SELECT
          pii.patient_id::text AS patient_id,
          ppm.patient_pseudonym_id,
          pii.full_name,
          pii.patient_code,
          pii.birth_date::text AS birth_date,
          pii.phone,
          au.login_id
        FROM patient_pii pii
        JOIN patient_pseudonym_map ppm ON ppm.patient_id = pii.patient_id
        JOIN app_users au ON au.patient_id = pii.patient_id
      `),t.query(`
        SELECT
          ltr.patient_pseudonym_id,
          cs.training_type,
          ltr.training_mode,
          ltr.rehab_step,
          cs.session_id::text AS session_id,
          ltr.result_id::text AS result_id,
          ltr.source_history_id,
          ltr.aq,
          cs.completed_at,
          ltr.created_at,
          ltr.step_scores,
          ltr.step_details,
          ltr.articulation_scores,
          ltr.facial_analysis_snapshot,
          ltr.measurement_quality,
          ltr.step_version_snapshots
        FROM language_training_results ltr
        JOIN clinical_sessions cs ON cs.session_id = ltr.session_id
        ORDER BY cs.completed_at DESC
      `),t.query(`
        SELECT
          sr.patient_pseudonym_id,
          cs.training_type,
          cs.session_id::text AS session_id,
          sr.result_id::text AS result_id,
          sr.score,
          sr.song_key,
          sr.jitter,
          sr.facial_symmetry,
          sr.latency_ms,
          sr.consonant_accuracy,
          sr.vowel_accuracy,
          sr.lyric_accuracy,
          sr.recognized_lyrics,
          sr.comment,
          sr.version_snapshot,
          cs.completed_at
        FROM sing_results sr
        JOIN clinical_sessions cs ON cs.session_id = sr.session_id
        ORDER BY cs.completed_at DESC
      `)]),o=new Map(i.rows.map(e=>[String(e.patient_pseudonym_id),e])),p=new Map;for(let e of n.rows){let t=String(e.patient_pseudonym_id),i=p.get(t)??[];i.push(e),p.set(t,i)}let l=new Map;for(let e of r.rows){let t=String(e.patient_pseudonym_id),i=l.get(t)??[];i.push(e),l.set(t,i)}let d=[];for(let[e,t]of o.entries())d.push(..._(t,p.get(e)??[],l.get(e)??[]));return d.sort((e,t)=>t.completedAt-e.completedAt)}async function l(e,t){let i=await (0,s.getAuthenticatedSessionContext)(e);if(!i)throw Error("unauthorized");let n=(0,a.getDbPool)(),o=(await n.query(`
      SELECT
        pii.patient_id::text AS patient_id,
        ppm.patient_pseudonym_id,
        pii.full_name,
        pii.patient_code,
        pii.birth_date::text AS birth_date,
        pii.phone,
        au.login_id
      FROM patient_pii pii
      JOIN patient_pseudonym_map ppm ON ppm.patient_id = pii.patient_id
      JOIN app_users au ON au.patient_id = pii.patient_id
      WHERE pii.patient_id::text = $1
      LIMIT 1
    `,[t])).rows[0];if(!o)throw Error("patient_not_found");let p=String(o.patient_pseudonym_id),[l,d]=await Promise.all([n.query(`
        SELECT
          cs.training_type,
          ltr.training_mode,
          ltr.rehab_step,
          cs.session_id::text AS session_id,
          cs.source_session_key,
          ltr.result_id::text AS result_id,
          ltr.source_history_id,
          ltr.aq,
          cs.completed_at,
          ltr.created_at,
          ltr.step_scores,
          ltr.step_details,
          ltr.articulation_scores,
          ltr.facial_analysis_snapshot,
          ltr.measurement_quality,
          ltr.step_version_snapshots
        FROM language_training_results ltr
        JOIN clinical_sessions cs ON cs.session_id = ltr.session_id
        WHERE ltr.patient_pseudonym_id = $1
        ORDER BY cs.completed_at DESC
      `,[p]),n.query(`
        SELECT
          cs.training_type,
          cs.session_id::text AS session_id,
          cs.source_session_key,
          sr.result_id::text AS result_id,
          sr.score,
          sr.song_key,
          sr.jitter,
          sr.facial_symmetry,
          sr.latency_ms,
          sr.consonant_accuracy,
          sr.vowel_accuracy,
          sr.lyric_accuracy,
          sr.recognized_lyrics,
          sr.comment,
          sr.version_snapshot,
          cs.completed_at
        FROM sing_results sr
        JOIN clinical_sessions cs ON cs.session_id = sr.session_id
        WHERE sr.patient_pseudonym_id = $1
        ORDER BY cs.completed_at DESC
      `,[p])]),c=Array.from(new Set(l.rows.map(e=>String(e.source_session_key??"").trim()).filter(e=>e.length>0))),u=Array.from(new Set(d.rows.map(e=>String(e.source_session_key??"").trim()).filter(e=>e.length>0))),[m,g,y,S]=await Promise.all([c.length>0?n.query(`
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
            `,[p,c]):Promise.resolve({rows:[]}),c.length>0?n.query(`
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
            `,[p,c]):Promise.resolve({rows:[]}),u.length>0?n.query(`
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
            `,[p,u]):Promise.resolve({rows:[]}),u.length>0?n.query(`
              SELECT
                source_session_key,
                object_key,
                uploaded_at,
                capture_role
              FROM clinical_media_objects
              WHERE patient_pseudonym_id = $1
                AND training_type = 'sing-training'
                AND media_type = 'image'
                AND capture_role LIKE 'face-keyframe-%'
                AND source_session_key = ANY($2::text[])
              ORDER BY source_session_key ASC, capture_role ASC, uploaded_at DESC
            `,[p,u]):Promise.resolve({rows:[]})]),h=new Map;for(let e of m.rows){let t=String(e.source_session_key??"").trim(),i=String(e.object_key??"").trim();if(!t||!i)continue;let s=h.get(t)??[];s.push(`/api/media/access?objectKey=${encodeURIComponent(i)}`),h.set(t,s)}let A=new Map;for(let e of g.rows){let t=String(e.source_session_key??"").trim(),i=Number(e.step_no??0),s=String(e.object_key??"").trim();if(!t||!i||!s)continue;let a=A.get(t)??{},n=a[i]??[];n.push(`/api/media/access?objectKey=${encodeURIComponent(s)}`),a[i]=n,A.set(t,a)}let N=new Map;for(let e of y.rows){let t=String(e.source_session_key??"").trim(),i=String(e.object_key??"").trim();!t||!i||N.has(t)||N.set(t,`/api/media/access?objectKey=${encodeURIComponent(i)}`)}let E=new Map;for(let e of S.rows){let t=String(e.source_session_key??"").trim(),i=String(e.object_key??"").trim(),s=String(e.capture_role??"keyframe").trim();if(!t||!i||!s)continue;let a=E.get(t)??new Map;a.has(s)||(a.set(s,{dataUrl:`/api/media/access?objectKey=${encodeURIComponent(i)}`,capturedAt:new Date(e.uploaded_at).toISOString(),label:s}),E.set(t,a))}let f=new Map(Array.from(E.entries()).map(([e,t])=>[e,Array.from(t.entries()).sort(([e],[t])=>e.localeCompare(t,void 0,{numeric:!0})).slice(0,3).map(([,e])=>e)])),b=_(o,l.rows.map(e=>{let t=String(e.source_session_key??"").trim(),i=h.get(t)??[],s=A.get(t)??{},a=e.step_details??{step1:[],step2:[],step3:[],step4:[],step5:[],step6:[]};return{...e,step_details:{...a,step2:Array.isArray(a.step2)?a.step2.map((e,t)=>({...e,audioUrl:r(e?.audioUrl)?e.audioUrl:s[2]?.[t]??void 0})):[],step4:Array.isArray(a.step4)?a.step4.map((e,t)=>({...e,audioUrl:r(e?.audioUrl)?e.audioUrl:s[4]?.[t]??void 0})):[],step5:Array.isArray(a.step5)?a.step5.map((e,t)=>({...e,audioUrl:r(e?.audioUrl)?e.audioUrl:s[5]?.[t]??void 0})):[],step6:Array.isArray(a.step6)?a.step6.map((e,t)=>({...e,userImage:!function(e){if("string"!=typeof e)return!1;let t=e.trim();return!!t&&(t.startsWith("data:image/")||t.startsWith("blob:")||t.startsWith("/api/media/access?")||/^https?:\/\//i.test(t))}(e?.userImage)?i[t]??void 0:e.userImage})):[]}}}),d.rows.map(e=>{let t=String(e.source_session_key??"").trim(),i=e.version_snapshot??void 0;return{...e,comment:e.comment||i?.measurement_metadata?.comment||"",recognized_lyrics:e.recognized_lyrics,version_snapshot:i?{...i,reviewKeyFrames:f.get(t)??[]}:i,review_audio_url:N.get(t),review_key_frames:f.get(t)??[]}})).map(e=>{if("sing"!==e.trainingMode||!e.singResult)return e;let t=d.rows.find(t=>String(t.session_id)===e.sessionId),i=String(t?.source_session_key??"").trim();return{...e,singResult:{...e.singResult,reviewAudioUrl:N.get(i),reviewKeyFrames:f.get(i)??[]}}});return{requestedBy:{userId:i.userId,patientName:i.patient.name},patient:{patientId:String(o.patient_id),patientPseudonymId:p,patientName:String(o.full_name),patientCode:String(o.patient_code),loginId:o.login_id?String(o.login_id):null,birthDate:o.birth_date?String(o.birth_date):null,phone:o.phone?String(o.phone):null},entries:b}}[s,a]=n.then?(await n)():n,e.s(["getAdminPatientReportDetail",()=>l,"listAdminPatientReportSummaries",()=>o,"listAdminReportValidationSample",()=>p]),i()}catch(e){i(e)}},!1)];

//# sourceMappingURL=src_lib_server_adminReportsDb_ts_49c0a997._.js.map