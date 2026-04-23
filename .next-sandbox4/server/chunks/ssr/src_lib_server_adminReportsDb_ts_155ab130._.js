module.exports=[45252,a=>a.a(async(b,c)=>{try{var d=a.i(40003),e=a.i(27788),f=b([d,e]);function g(a){if("string"!=typeof a)return!1;let b=a.trim();return!!b&&(b.startsWith("data:audio/")||b.startsWith("blob:")||b.startsWith("/api/media/access?")||/^https?:\/\//i.test(b))}async function h(a){if(!await (0,d.getAuthenticatedSessionContext)(a))throw Error("unauthorized");let b=(0,e.getDbPool)(),c=await b.connect();try{let a=await c.query(`
        SELECT
          to_regclass('public.therapist_patient_assignments') IS NOT NULL AS has_assignments,
          to_regclass('public.patient_intake_profiles')       IS NOT NULL AS has_intake,
          to_regclass('public.organizations')                 IS NOT NULL AS has_organizations
      `),b=!!a.rows[0]?.has_assignments,d=!!a.rows[0]?.has_intake,e=!!a.rows[0]?.has_organizations,f=b?`
          tpii.full_name AS therapist_name,
          tu.login_id    AS therapist_login_id,
          tu.user_id::text AS therapist_user_id,
          ${e?"torg.organization_name":"NULL::text"} AS therapist_organization_name,
      `:`
          NULL::text AS therapist_name,
          NULL::text AS therapist_login_id,
          NULL::text AS therapist_user_id,
          NULL::text AS therapist_organization_name,
      `,g=b?`
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
      `:"",h=d?`
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
      `;return(await c.query(`
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
          ${h}
          ${f}
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
        ${g}
        ORDER BY latest_activity_at DESC NULLS LAST, pii.created_at DESC
      `)).rows.map(a=>{let b="string"==typeof a.sex?a.sex.trim().toUpperCase():"",c="string"==typeof a.hemiplegia?a.hemiplegia.trim().toUpperCase():"",d="string"==typeof a.hemianopsia?a.hemianopsia.trim().toUpperCase():"";return{patientId:String(a.patient_id),patientPseudonymId:String(a.patient_pseudonym_id),patientName:String(a.full_name),patientCode:String(a.patient_code),loginId:a.login_id?String(a.login_id):null,birthDate:a.birth_date?String(a.birth_date):null,phone:a.phone?String(a.phone):null,sex:"M"===b||"F"===b||"U"===b?b:null,educationYears:null==a.education_years?null:Number(a.education_years),onsetDate:a.onset_date?String(a.onset_date):null,daysSinceOnset:null==a.days_since_onset?null:Number(a.days_since_onset),hemiplegia:"Y"===c||"N"===c?c:null,hemianopsia:"LEFT"===d||"RIGHT"===d||"NONE"===d?d:null,hand:a.hand?String(a.hand):null,latestActivityAt:a.latest_activity_at?String(a.latest_activity_at):null,createdAt:a.created_at?String(a.created_at):null,selfAssessmentCount:Number(a.self_assessment_count??0),rehabCount:Number(a.rehab_count??0),singCount:Number(a.sing_count??0),therapistName:a.therapist_name?String(a.therapist_name):null,therapistLoginId:a.therapist_login_id?String(a.therapist_login_id):null,therapistUserId:a.therapist_user_id?String(a.therapist_user_id):null,therapistOrganizationName:a.therapist_organization_name?String(a.therapist_organization_name):null}})}finally{c.release()}}function i(a,b,c){let d=String(a.patient_pseudonym_id);return[...b.map(b=>{let c=b.step_details&&"object"==typeof b.step_details?b.step_details:{};return{historyId:b.source_history_id?String(b.source_history_id):String(b.result_id),sessionId:String(b.session_id),patientKey:d,patientName:String(a.full_name),birthDate:a.birth_date?String(a.birth_date):"",age:0,educationYears:0,place:"home",trainingMode:"rehab"===b.training_mode?"rehab":"self",rehabStep:null==b.rehab_step?void 0:Number(b.rehab_step),completedAt:new Date(b.completed_at).getTime(),aq:Number(b.aq??0),stepScores:b.step_scores??{step1:0,step2:0,step3:0,step4:0,step5:0,step6:0},stepDetails:{step1:Array.isArray(c.step1)?c.step1:[],step2:Array.isArray(c.step2)?c.step2:[],step3:Array.isArray(c.step3)?c.step3:[],step4:Array.isArray(c.step4)?c.step4:[],step5:Array.isArray(c.step5)?c.step5:[],step6:Array.isArray(c.step6)?c.step6:[]},articulationScores:b.articulation_scores??void 0,facialAnalysisSnapshot:b.facial_analysis_snapshot??void 0,measurementQuality:b.measurement_quality??void 0,stepVersionSnapshots:b.step_version_snapshots??void 0,vnv:c.__meta?.vnv??void 0}}),...c.map(b=>({historyId:`history_sing_${String(b.result_id??new Date(b.completed_at).getTime())}`,sessionId:String(b.session_id),patientKey:d,patientName:String(a.full_name),birthDate:a.birth_date?String(a.birth_date):"",age:0,educationYears:0,place:"brain-sing",trainingMode:"sing",completedAt:new Date(b.completed_at).getTime(),aq:Number(b.score??0),singResult:{song:String(b.song_key),score:Number(b.score??0),finalJitter:null==b.jitter?"-":String(b.jitter),finalSi:null==b.facial_symmetry?"-":String(b.facial_symmetry),rtLatency:null==b.latency_ms?"-":String(b.latency_ms),finalConsonant:null==b.consonant_accuracy?"-":String(b.consonant_accuracy),finalVowel:null==b.vowel_accuracy?"-":String(b.vowel_accuracy),lyricAccuracy:null==b.lyric_accuracy?"-":String(b.lyric_accuracy),transcript:null==b.recognized_lyrics?"":String(b.recognized_lyrics),comment:b.comment?String(b.comment):"",rankings:[],versionSnapshot:b.version_snapshot??void 0},stepScores:{step1:0,step2:0,step3:0,step4:0,step5:0,step6:0},stepDetails:{step1:[],step2:[],step3:[],step4:[],step5:[],step6:[]}}))].sort((a,b)=>b.completedAt-a.completedAt)}async function j(a){if(!await (0,d.getAuthenticatedSessionContext)(a))throw Error("unauthorized");let b=(0,e.getDbPool)(),[c,f,g]=await Promise.all([b.query(`
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
      `),b.query(`
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
      `),b.query(`
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
      `)]),h=new Map(c.rows.map(a=>[String(a.patient_pseudonym_id),a])),j=new Map;for(let a of f.rows){let b=String(a.patient_pseudonym_id),c=j.get(b)??[];c.push(a),j.set(b,c)}let k=new Map;for(let a of g.rows){let b=String(a.patient_pseudonym_id),c=k.get(b)??[];c.push(a),k.set(b,c)}let l=[];for(let[a,b]of h.entries())l.push(...i(b,j.get(a)??[],k.get(a)??[]));return l.sort((a,b)=>b.completedAt-a.completedAt)}async function k(a,b){let c=await (0,d.getAuthenticatedSessionContext)(a);if(!c)throw Error("unauthorized");let f=(0,e.getDbPool)(),h=(await f.query(`
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
    `,[b])).rows[0];if(!h)throw Error("patient_not_found");let j=String(h.patient_pseudonym_id),[k,l]=await Promise.all([f.query(`
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
      `,[j]),f.query(`
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
      `,[j])]),m=Array.from(new Set(k.rows.map(a=>String(a.source_session_key??"").trim()).filter(a=>a.length>0))),n=Array.from(new Set(l.rows.map(a=>String(a.source_session_key??"").trim()).filter(a=>a.length>0))),[o,p,q,r]=await Promise.all([m.length>0?f.query(`
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
            `,[j,m]):Promise.resolve({rows:[]}),m.length>0?f.query(`
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
            `,[j,m]):Promise.resolve({rows:[]}),n.length>0?f.query(`
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
            `,[j,n]):Promise.resolve({rows:[]}),n.length>0?f.query(`
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
            `,[j,n]):Promise.resolve({rows:[]})]),s=new Map;for(let a of o.rows){let b=String(a.source_session_key??"").trim(),c=String(a.object_key??"").trim();if(!b||!c)continue;let d=s.get(b)??[];d.push(`/api/media/access?objectKey=${encodeURIComponent(c)}`),s.set(b,d)}let t=new Map;for(let a of p.rows){let b=String(a.source_session_key??"").trim(),c=Number(a.step_no??0),d=String(a.object_key??"").trim();if(!b||!c||!d)continue;let e=t.get(b)??{},f=e[c]??[];f.push(`/api/media/access?objectKey=${encodeURIComponent(d)}`),e[c]=f,t.set(b,e)}let u=new Map;for(let a of q.rows){let b=String(a.source_session_key??"").trim(),c=String(a.object_key??"").trim();!b||!c||u.has(b)||u.set(b,`/api/media/access?objectKey=${encodeURIComponent(c)}`)}let v=new Map;for(let a of r.rows){let b=String(a.source_session_key??"").trim(),c=String(a.object_key??"").trim(),d=String(a.capture_role??"keyframe").trim();if(!b||!c||!d)continue;let e=v.get(b)??new Map;e.has(d)||(e.set(d,{dataUrl:`/api/media/access?objectKey=${encodeURIComponent(c)}`,capturedAt:new Date(a.uploaded_at).toISOString(),label:d}),v.set(b,e))}let w=new Map(Array.from(v.entries()).map(([a,b])=>[a,Array.from(b.entries()).sort(([a],[b])=>a.localeCompare(b,void 0,{numeric:!0})).slice(0,3).map(([,a])=>a)])),x=i(h,k.rows.map(a=>{let b=String(a.source_session_key??"").trim(),c=s.get(b)??[],d=t.get(b)??{},e=a.step_details??{step1:[],step2:[],step3:[],step4:[],step5:[],step6:[]};return{...a,step_details:{...e,step2:Array.isArray(e.step2)?e.step2.map((a,b)=>({...a,audioUrl:g(a?.audioUrl)?a.audioUrl:d[2]?.[b]??void 0})):[],step4:Array.isArray(e.step4)?e.step4.map((a,b)=>({...a,audioUrl:g(a?.audioUrl)?a.audioUrl:d[4]?.[b]??void 0})):[],step5:Array.isArray(e.step5)?e.step5.map((a,b)=>({...a,audioUrl:g(a?.audioUrl)?a.audioUrl:d[5]?.[b]??void 0})):[],step6:Array.isArray(e.step6)?e.step6.map((a,b)=>({...a,userImage:!function(a){if("string"!=typeof a)return!1;let b=a.trim();return!!b&&(b.startsWith("data:image/")||b.startsWith("blob:")||b.startsWith("/api/media/access?")||/^https?:\/\//i.test(b))}(a?.userImage)?c[b]??void 0:a.userImage})):[]}}}),l.rows.map(a=>{let b=String(a.source_session_key??"").trim(),c=a.version_snapshot??void 0;return{...a,comment:a.comment||c?.measurement_metadata?.comment||"",recognized_lyrics:a.recognized_lyrics,version_snapshot:c?{...c,reviewKeyFrames:w.get(b)??[]}:c,review_audio_url:u.get(b),review_key_frames:w.get(b)??[]}})).map(a=>{if("sing"!==a.trainingMode||!a.singResult)return a;let b=l.rows.find(b=>String(b.session_id)===a.sessionId),c=String(b?.source_session_key??"").trim();return{...a,singResult:{...a.singResult,reviewAudioUrl:u.get(c),reviewKeyFrames:w.get(c)??[]}}});return{requestedBy:{userId:c.userId,patientName:c.patient.name},patient:{patientId:String(h.patient_id),patientPseudonymId:j,patientName:String(h.full_name),patientCode:String(h.patient_code),loginId:h.login_id?String(h.login_id):null,birthDate:h.birth_date?String(h.birth_date):null,phone:h.phone?String(h.phone):null},entries:x}}[d,e]=f.then?(await f)():f,a.s(["getAdminPatientReportDetail",()=>k,"listAdminPatientReportSummaries",()=>h,"listAdminReportValidationSample",()=>j]),c()}catch(a){c(a)}},!1)];

//# sourceMappingURL=src_lib_server_adminReportsDb_ts_155ab130._.js.map