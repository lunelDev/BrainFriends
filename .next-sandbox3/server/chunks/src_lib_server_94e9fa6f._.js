module.exports=[47432,e=>{"use strict";var t=e.i(24868),a=e.i(14747);let i=a.default.join(process.cwd(),"data","patient-links"),n=a.default.join(i,"therapist-assignments.json");async function s(){await (0,t.mkdir)(i,{recursive:!0})}async function r(){await s();try{let e=await (0,t.readFile)(n,"utf8"),a=JSON.parse(e);return Array.isArray(a)?a:[]}catch{return[]}}async function o(e){await s(),await (0,t.writeFile)(n,JSON.stringify(e,null,2),"utf8")}function _(e){return String(e??"").trim()}async function p(e){let t=_(e.patientId),a=_(e.therapistUserId),i=_(e.organizationId)||void 0;if(!t||!a)throw Error("invalid_patient_assignment");let n=await r(),s=new Date().toISOString(),p=n.findIndex(e=>e.patientId===t),d={patientId:t,therapistUserId:a,organizationId:i,isActive:!0,assignedAt:p>=0?n[p].assignedAt:s,updatedAt:s};return p>=0?n[p]=d:n.unshift(d),await o(n),d}async function d(e){let t=_(e);return!!t&&(await r()).some(e=>e.patientId===t&&!1!==e.isActive)}e.s(["hasFallbackPatientTherapistAssignment",()=>d,"upsertFallbackPatientTherapistAssignment",()=>p])},32476,e=>e.a(async(t,a)=>{try{var i=e.i(54799),n=e.i(63528),s=e.i(92768),r=e.i(47432),o=e.i(77545),_=t([n,o]);[n,o]=_.then?(await _)():_;let z="admin",F="0000";function p(e){return e.trim().replace(/\s+/g," ")}function d(e){if(!/^\d{4}-\d{2}-\d{2}$/.test(e))return!1;let[t,a,i]=e.split("-").map(Number),n=new Date(Date.UTC(t,a-1,i));return n.getUTCFullYear()===t&&n.getUTCMonth()===a-1&&n.getUTCDate()===i}function u(){return new Date().toISOString().slice(0,10)}function l(e){return d(e)&&e<=u()}function h(e){return e.replace(/\D/g,"").slice(0,4)}function E(e){return e.trim().toLowerCase()}function g(e){return/^[a-z0-9_-]{4,20}$/.test(e)}function c(e){return[p(e.name).toLowerCase(),e.birthDate.trim(),h(e.phoneLast4)].join("|")}function m(e){return(0,i.createHash)("sha256").update(e).digest("hex")}function y(e){let t=(0,i.randomBytes)(16).toString("hex"),a=(0,i.scryptSync)(e,t,64).toString("hex");return`${t}:${a}`}function w(e){let t=new Date(`${e}T00:00:00`);if(Number.isNaN(t.getTime()))return 0;let a=new Date;a.setHours(0,0,0,0);let i=a.getFullYear()-t.getFullYear();return(a.getMonth()<t.getMonth()||a.getMonth()===t.getMonth()&&a.getDate()<t.getDate())&&(i-=1),Math.max(i,0)}function S(e){let t=new Date(`${e}T00:00:00`);if(Number.isNaN(t.getTime()))return;let a=new Date;a.setHours(0,0,0,0);let i=a.getTime()-t.getTime();return i<0?0:Math.floor(i/864e5)+1}function N(e){return"admin"===e?"admin":"therapist"===e?"therapist":"patient"}async function D(e,t){let a=await e.query("SELECT to_regclass($1) IS NOT NULL AS exists",[`public.${t}`]);return!!a.rows[0]?.exists}async function O(e,t,a){let i=await e.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,[t,a]);return!!i.rows[0]?.exists}async function f(e,t){if(!await D(e,"organizations"))return null;let a=await (0,s.getAvailableOrganizationById)(t);if(!a)throw Error("invalid_organization");return await e.query(`
      INSERT INTO organizations (
        organization_id,
        organization_name,
        organization_code,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, TRUE, NOW(), NOW())
      ON CONFLICT (organization_id) DO UPDATE
      SET
        organization_name = EXCLUDED.organization_name,
        organization_code = EXCLUDED.organization_code,
        is_active = TRUE,
        updated_at = NOW()
    `,[a.id,a.name,a.code]),a}function T(e){let t=e.birth_date??"";return{sessionId:e.session_seed||(0,i.randomUUID)(),userRole:N(e.user_role),organizationId:e.organization_id?String(e.organization_id):null,hasAssignedTherapist:!!e.has_assigned_therapist,name:e.full_name,birthDate:t,gender:e.sex??"U",age:w(t),educationYears:Number(e.education_years??0),onsetDate:e.onset_date??"",daysSinceOnset:e.days_since_onset??S(e.onset_date??""),hemiplegia:e.hemiplegia??"N",hemianopsia:e.hemianopsia??"NONE",phone:e.phone??"",hand:"U",language:"한국어",createdAt:Date.now(),updatedAt:Date.now()}}function L(e){return e.length>=6}function I(e){return E(e)}async function A(e){let t={sessionId:(0,i.randomUUID)(),userRole:"admin",name:"관리자",birthDate:"1970-01-01",gender:"U",age:w("1970-01-01"),educationYears:0,onsetDate:"",daysSinceOnset:void 0,hemiplegia:"N",hemianopsia:"NONE",phone:"0000",hand:"U",language:"한국어",createdAt:Date.now(),updatedAt:Date.now()},a=m(c({name:t.name,birthDate:t.birthDate,phoneLast4:"0000"})),{patientId:n}=await (0,o.upsertPatientIdentity)(e,t),s=(0,i.randomUUID)();await e.query(`
      INSERT INTO patient_intake_profiles (
        patient_id,
        education_years,
        onset_date,
        days_since_onset,
        hemiplegia,
        hemianopsia,
        hand,
        created_at,
        updated_at
      )
      VALUES ($1, $2, NULL, NULL, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (patient_id) DO UPDATE
      SET
        education_years = EXCLUDED.education_years,
        hemiplegia = EXCLUDED.hemiplegia,
        hemianopsia = EXCLUDED.hemianopsia,
        hand = EXCLUDED.hand,
        updated_at = NOW()
    `,[n,0,"N","NONE","U"]),await e.query(`
      INSERT INTO app_users (
        user_id,
        patient_id,
        user_role,
        login_id,
        login_key_hash,
        password_hash,
        created_at,
        updated_at
      )
      VALUES ($1, $2, 'admin', $3, $4, $5, NOW(), NOW())
      ON CONFLICT (login_id) DO UPDATE
      SET
        patient_id = EXCLUDED.patient_id,
        user_role = 'admin',
        login_key_hash = EXCLUDED.login_key_hash,
        password_hash = EXCLUDED.password_hash,
        updated_at = NOW()
    `,[s,n,z,a,y(F)])}async function U(e){var t,a;let s=N(e.userRole),_=String(e.organizationId??"").trim()||null,T=String(e.therapistUserId??"").trim()||null,I="pending"===e.approvalState?"pending":"approved",A=E(e.loginId),U=p(e.name),C=e.birthDate.trim(),$=h(e.phoneLast4);if(!A||!g(A)||A===z||!U||!l(C)||4!==$.length||!L(e.password)||"patient"===s&&e.onsetDate&&(t=String(e.onsetDate),!(d(t)&&t<=u())))throw Error("invalid_signup_payload");let v=Number(e.educationYears??0),R=String(e.onsetDate??""),k="M"===e.gender||"F"===e.gender?e.gender:"U",x="Y"===e.hemiplegia?"Y":"N",b="LEFT"===e.hemianopsia||"RIGHT"===e.hemianopsia?e.hemianopsia:"NONE",W=m(c({name:U,birthDate:C,phoneLast4:$})),F=m((a={name:U,phoneLast4:$},[p(a.name).toLowerCase(),h(a.phoneLast4)].join("|"))),M=(0,n.getDbPool)(),q=await M.connect();try{if(await q.query("BEGIN"),await q.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS identity_key_hash VARCHAR(64) NULL"),(await q.query("SELECT user_id FROM app_users WHERE login_id = $1 OR login_key_hash = $2 LIMIT 1",[A,W])).rowCount)throw Error("account_already_exists");if((await q.query("SELECT user_id FROM app_users WHERE identity_key_hash = $1 LIMIT 1",[F])).rowCount)throw Error("duplicate_identity");let t={sessionId:(0,i.randomUUID)(),name:U,birthDate:C,gender:k,age:w(C),educationYears:v,onsetDate:R,daysSinceOnset:S(R),hemiplegia:x,hemianopsia:b,phone:$,hand:"U",language:"한국어",createdAt:Date.now(),updatedAt:Date.now()},{patientId:a}=await (0,o.upsertPatientIdentity)(q,t),n=(0,i.randomUUID)(),p=await O(q,"app_users","organization_id"),d=await O(q,"app_users","approval_state"),u=await D(q,"therapist_patient_assignments");if(_&&p&&await f(q,_),"patient"===s&&T&&!(await q.query(`
          SELECT
            u.user_id::text AS user_id
          FROM app_users u
          WHERE u.user_id = $1::uuid
            AND u.user_role = 'therapist'
            ${p?"AND u.organization_id = $2::uuid":""}
            ${d?"AND COALESCE(u.approval_state, 'approved') = 'approved'":""}
          LIMIT 1
        `,p?[T,_]:[T])).rowCount)throw Error("invalid_therapist");await q.query(`
        INSERT INTO patient_intake_profiles (
          patient_id,
          education_years,
          onset_date,
          days_since_onset,
          hemiplegia,
          hemianopsia,
          hand,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (patient_id) DO UPDATE
        SET
          education_years = EXCLUDED.education_years,
          onset_date = EXCLUDED.onset_date,
          days_since_onset = EXCLUDED.days_since_onset,
          hemiplegia = EXCLUDED.hemiplegia,
          hemianopsia = EXCLUDED.hemianopsia,
          hand = EXCLUDED.hand,
          updated_at = NOW()
      `,[a,v,R||null,S(R)??null,x,b,"U"]);let l=["user_id","patient_id","user_role","login_id","login_key_hash","password_hash","identity_key_hash"],h=[n,a,s,A,W,y(e.password),F];p&&(l.push("organization_id"),h.push(_)),d&&(l.push("approval_state"),h.push(I));let E=h.map((e,t)=>`$${t+1}`).join(", ");return await q.query(`
        INSERT INTO app_users (
          ${l.join(", ")}
        )
        VALUES (${E})
      `,h),"patient"===s&&T&&u&&((await q.query(`
          UPDATE therapist_patient_assignments
          SET
            is_active = TRUE,
            assigned_at = NOW()
          WHERE therapist_user_id = $1::uuid
            AND patient_id = $2::uuid
        `,[T,a])).rowCount||await q.query(`
            INSERT INTO therapist_patient_assignments (
              assignment_id,
              therapist_user_id,
              patient_id,
              is_active,
              assigned_at
            )
            VALUES ($1, $2::uuid, $3::uuid, TRUE, NOW())
          `,[(0,i.randomUUID)(),T,a])),"patient"===s&&T&&!u&&await (0,r.upsertFallbackPatientTherapistAssignment)({patientId:a,therapistUserId:T,organizationId:_}),await q.query("COMMIT"),{userId:n,patientId:a}}catch(e){throw await q.query("ROLLBACK"),e}finally{q.release()}}async function C(e){let t=E(e.loginId);if(!t||!g(t)||!e.password)throw Error("invalid_login_payload");let a=(0,n.getDbPool)(),s=await a.connect();try{let a=await O(s,"app_users","organization_id"),n=await O(s,"app_users","approval_state"),o=await D(s,"therapist_patient_assignments");if(t===z&&e.password===F){await s.query("BEGIN");try{await A(s),await s.query("COMMIT")}catch(e){throw await s.query("ROLLBACK"),e}}let _=(await s.query(`
        SELECT
          u.user_id,
          COALESCE(u.user_role, 'patient') AS user_role,
          ${n?"COALESCE(u.approval_state, 'approved') AS approval_state,":"'approved'::text AS approval_state,"}
          ${a?"u.organization_id::text AS organization_id,":"NULL::text AS organization_id,"}
          ${o?"EXISTS (SELECT 1 FROM therapist_patient_assignments tpa WHERE tpa.patient_id = u.patient_id AND COALESCE(tpa.is_active, TRUE) = TRUE) AS has_assigned_therapist,":"FALSE AS has_assigned_therapist,"}
          u.patient_id::text AS patient_id,
          u.password_hash,
          pii.full_name,
          pii.birth_date::text,
          pii.sex,
          pii.phone,
          intake.education_years,
          intake.onset_date::text,
          intake.days_since_onset,
          intake.hemiplegia,
          intake.hemianopsia
        FROM app_users u
        JOIN patient_pii pii ON pii.patient_id = u.patient_id
        LEFT JOIN patient_intake_profiles intake ON intake.patient_id = u.patient_id
        WHERE u.login_id = $1
        LIMIT 1
      `,[t])).rows[0];if(!_||!function(e,t){let[a,n]=t.split(":");if(!a||!n)return!1;let s=(0,i.scryptSync)(e,a,64).toString("hex");return(0,i.timingSafeEqual)(Buffer.from(s,"hex"),Buffer.from(n,"hex"))}(e.password,_.password_hash))throw Error("invalid_credentials");if("therapist"===_.user_role&&"approved"!==_.approval_state)throw Error("approval_pending");let p=(0,i.randomBytes)(32).toString("base64url"),d=(0,i.randomUUID)(),u=(0,i.randomUUID)(),l=new Date(Date.now()+2592e6);await s.query(`
        INSERT INTO auth_sessions (
          session_id,
          user_id,
          session_token_hash,
          session_seed,
          expires_at,
          created_at,
          last_seen_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `,[d,_.user_id,m(p),u,l]),await s.query(`
        UPDATE app_users
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE user_id = $1
      `,[_.user_id]);let h=o||"patient"!==_.user_role?!!_.has_assigned_therapist:await (0,r.hasFallbackPatientTherapistAssignment)(String(_.patient_id));return{sessionToken:p,expiresAt:l,patient:T({session_seed:u,user_role:_.user_role,organization_id:_.organization_id,has_assigned_therapist:h,full_name:_.full_name,birth_date:_.birth_date,sex:_.sex,phone:_.phone,education_years:_.education_years,onset_date:_.onset_date,days_since_onset:_.days_since_onset,hemiplegia:_.hemiplegia,hemianopsia:_.hemianopsia})}}finally{s.release()}}async function $(e){let t=(0,n.getDbPool)(),a=await t.connect();try{let t=await O(a,"app_users","organization_id"),i=await O(a,"app_users","approval_state"),n=await D(a,"therapist_patient_assignments"),s=(await a.query(`
        SELECT
          s.session_id,
          s.session_seed,
          COALESCE(u.user_role, 'patient') AS user_role,
          ${i?"COALESCE(u.approval_state, 'approved') AS approval_state,":"'approved'::text AS approval_state,"}
          ${t?"u.organization_id::text AS organization_id,":"NULL::text AS organization_id,"}
          ${n?"EXISTS (SELECT 1 FROM therapist_patient_assignments tpa WHERE tpa.patient_id = u.patient_id AND COALESCE(tpa.is_active, TRUE) = TRUE) AS has_assigned_therapist,":"FALSE AS has_assigned_therapist,"}
          u.patient_id::text AS patient_id,
          pii.full_name,
          pii.birth_date::text,
          pii.sex,
          pii.phone,
          intake.education_years,
          intake.onset_date::text,
          intake.days_since_onset,
          intake.hemiplegia,
          intake.hemianopsia
        FROM auth_sessions s
        JOIN app_users u ON u.user_id = s.user_id
        JOIN patient_pii pii ON pii.patient_id = u.patient_id
        LEFT JOIN patient_intake_profiles intake ON intake.patient_id = u.patient_id
        WHERE s.session_token_hash = $1
          AND s.expires_at > NOW()
        LIMIT 1
      `,[m(e)])).rows[0];if(!s||"therapist"===s.user_role&&"approved"!==s.approval_state)return null;await a.query("UPDATE auth_sessions SET last_seen_at = NOW() WHERE session_id = $1",[s.session_id]);let o=n||"patient"!==s.user_role?!!s.has_assigned_therapist:await (0,r.hasFallbackPatientTherapistAssignment)(String(s.patient_id));return T({session_seed:s.session_seed,user_role:s.user_role,organization_id:s.organization_id,has_assigned_therapist:o,full_name:s.full_name,birth_date:s.birth_date,sex:s.sex,phone:s.phone,education_years:s.education_years,onset_date:s.onset_date,days_since_onset:s.days_since_onset,hemiplegia:s.hemiplegia,hemianopsia:s.hemianopsia})}finally{a.release()}}async function v(e){let t=(0,n.getDbPool)(),a=await t.connect();try{let t=await O(a,"app_users","approval_state"),i=(await a.query(`
        SELECT
          s.session_id,
          s.session_seed,
          COALESCE(u.user_role, 'patient') AS user_role,
          ${t?"COALESCE(u.approval_state, 'approved') AS approval_state,":"'approved'::text AS approval_state,"}
          u.user_id::text AS user_id,
          u.patient_id::text AS patient_id,
          ppm.patient_pseudonym_id,
          pii.full_name,
          pii.birth_date::text,
          pii.sex,
          pii.phone,
          intake.education_years,
          intake.onset_date::text,
          intake.days_since_onset,
          intake.hemiplegia,
          intake.hemianopsia
        FROM auth_sessions s
        JOIN app_users u ON u.user_id = s.user_id
        JOIN patient_pii pii ON pii.patient_id = u.patient_id
        JOIN patient_pseudonym_map ppm ON ppm.patient_id = u.patient_id
        LEFT JOIN patient_intake_profiles intake ON intake.patient_id = u.patient_id
        WHERE s.session_token_hash = $1
          AND s.expires_at > NOW()
        LIMIT 1
      `,[m(e)])).rows[0];if(!i||"therapist"===i.user_role&&"approved"!==i.approval_state)return null;return await a.query("UPDATE auth_sessions SET last_seen_at = NOW() WHERE session_id = $1",[i.session_id]),{userId:String(i.user_id),patientId:String(i.patient_id),patientPseudonymId:String(i.patient_pseudonym_id),userRole:N(i.user_role),patient:T({session_seed:i.session_seed,user_role:i.user_role,full_name:i.full_name,birth_date:i.birth_date,sex:i.sex,phone:i.phone,education_years:i.education_years,onset_date:i.onset_date,days_since_onset:i.days_since_onset,hemiplegia:i.hemiplegia,hemianopsia:i.hemianopsia})}}finally{a.release()}}async function R(e){let t=(0,n.getDbPool)();await t.query("DELETE FROM auth_sessions WHERE session_token_hash = $1",[m(e)])}async function k(e){let t=E(e);if(!g(t))return{available:!1,reason:"invalid_format",normalizedLoginId:t};if(t===z)return{available:!1,reason:"reserved_admin",normalizedLoginId:t};let a=(0,n.getDbPool)(),i=await a.query("SELECT 1 FROM app_users WHERE login_id = $1 LIMIT 1",[t]);return{available:0===i.rowCount,reason:0===i.rowCount?null:"already_taken",normalizedLoginId:t}}function x(e){let t=p(e.name),a=e.birthDate.trim(),i=h(e.phoneLast4);if(!t||!l(a)||4!==i.length)throw Error("invalid_recovery_payload");return{name:t,birthDate:a,phoneLast4:i}}async function b(e){let{name:t,birthDate:a,phoneLast4:i}=x(e),s=m(c({name:t,birthDate:a,phoneLast4:i})),r=(0,n.getDbPool)(),o=(await r.query(`
      SELECT login_id
      FROM app_users
      WHERE login_key_hash = $1
      LIMIT 1
    `,[s])).rows[0];if(!o)throw Error("account_not_found");return{loginId:String(o.login_id)}}async function W(e){let{name:t,birthDate:a,phoneLast4:i}=x(e);if(!L(e.newPassword))throw Error("invalid_password_payload");let s=m(c({name:t,birthDate:a,phoneLast4:i})),r=(0,n.getDbPool)(),o=await r.query(`
      UPDATE app_users
      SET password_hash = $2, updated_at = NOW()
      WHERE login_key_hash = $1
      RETURNING user_id
    `,[s,y(e.newPassword)]);if(!o.rowCount)throw Error("account_not_found");return await r.query(`
      DELETE FROM auth_sessions
      WHERE user_id = $1
    `,[o.rows[0].user_id]),{ok:!0}}e.s(["AUTH_COOKIE_NAME",0,"brainfriends_session","authenticateAccount",()=>C,"createAccount",()=>U,"findLoginIdByIdentity",()=>b,"getAuthenticatedSessionContext",()=>v,"getPatientProfileFromSession",()=>$,"invalidateSession",()=>R,"isLoginIdAvailable",()=>k,"resetPasswordByIdentity",()=>W,"sanitizeLoginId",()=>I]),a()}catch(e){a(e)}},!1)];

//# sourceMappingURL=src_lib_server_94e9fa6f._.js.map