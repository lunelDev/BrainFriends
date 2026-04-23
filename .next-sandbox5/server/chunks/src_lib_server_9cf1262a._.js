module.exports=[75431,e=>{"use strict";function t(e,i=!1){let n=process.env[e];if(null==n||""===n)return i;let a=n.trim().toLowerCase();return!!["1","true","yes","on"].includes(a)||!["0","false","no","off"].includes(a)&&i}e.s(["featureFlags",0,{get useNewUsersSchema(){return t("USE_NEW_USERS_SCHEMA",!1)},get useNewUsersSchemaStrict(){return t("USE_NEW_USERS_SCHEMA_STRICT",!1)}}])},99128,e=>e.a(async(t,i)=>{try{var n=e.i(63528),a=t([n]);async function s(e,t){var i;return i=(await e.query(`
      INSERT INTO users (
        id, name, email, phone,
        login_id, password_hash, login_key_hash,
        account_type, status, legacy_user_role,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
      SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        login_id = EXCLUDED.login_id,
        password_hash = EXCLUDED.password_hash,
        login_key_hash = COALESCE(EXCLUDED.login_key_hash, users.login_key_hash),
        account_type = EXCLUDED.account_type,
        status = EXCLUDED.status,
        legacy_user_role = COALESCE(EXCLUDED.legacy_user_role, users.legacy_user_role),
        updated_at = NOW()
      RETURNING *
    `,[t.id,t.name,t.email,t.phone,t.loginId,t.passwordHash,t.loginKeyHash??null,t.accountType,t.status??"PENDING",t.legacyUserRole??null])).rows[0],{id:String(i.id),name:String(i.name??""),email:String(i.email??""),phone:String(i.phone??""),loginId:String(i.login_id??""),passwordHash:String(i.password_hash??""),loginKeyHash:i.login_key_hash?String(i.login_key_hash):null,accountType:String(i.account_type??"USER"),status:String(i.status??"PENDING"),legacyUserRole:i.legacy_user_role?String(i.legacy_user_role):null,lastLoginAt:i.last_login_at?new Date(String(i.last_login_at)):null,createdAt:new Date(String(i.created_at)),updatedAt:new Date(String(i.updated_at))}}[n]=a.then?(await a)():a,e.s(["upsertNewUser",()=>s]),i()}catch(e){i(e)}},!1),80471,e=>e.a(async(t,i)=>{try{var n=e.i(63528),a=t([n]);async function s(e,t){var i;let n;return n=(i=(await e.query(`
      INSERT INTO user_pii_profile (
        user_id, birth_date, sex, language,
        legacy_patient_code, legacy_patient_id,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET
        birth_date = EXCLUDED.birth_date,
        sex = EXCLUDED.sex,
        language = EXCLUDED.language,
        legacy_patient_code = COALESCE(EXCLUDED.legacy_patient_code, user_pii_profile.legacy_patient_code),
        legacy_patient_id   = COALESCE(EXCLUDED.legacy_patient_id,   user_pii_profile.legacy_patient_id),
        updated_at = NOW()
      RETURNING *
    `,[t.userId,t.birthDate??null,t.sex??null,t.language??null,t.legacyPatientCode??null,t.legacyPatientId??null])).rows[0]).birth_date,{userId:String(i.user_id),birthDate:n?n instanceof Date?n.toISOString().slice(0,10):String(n).slice(0,10):null,sex:i.sex?String(i.sex):null,language:i.language?String(i.language):null,legacyPatientCode:i.legacy_patient_code?String(i.legacy_patient_code):null,legacyPatientId:i.legacy_patient_id?String(i.legacy_patient_id):null,createdAt:new Date(String(i.created_at)),updatedAt:new Date(String(i.updated_at))}}[n]=a.then?(await a)():a,e.s(["upsertUserPiiProfile",()=>s]),i()}catch(e){i(e)}},!1),95100,e=>e.a(async(t,i)=>{try{var n=e.i(54799),a=e.i(63528),s=t([a]);function r(e){let t=e.issued_date;return{id:String(e.id),userId:String(e.user_id),jobType:String(e.job_type??""),licenseNumber:String(e.license_number??""),licenseFileUrl:String(e.license_file_url??""),issuedBy:e.issued_by?String(e.issued_by):null,issuedDate:t?t instanceof Date?t.toISOString().slice(0,10):String(t).slice(0,10):null,specialty:e.specialty?String(e.specialty):null,introduction:e.introduction?String(e.introduction):null,isPublic:!!e.is_public,verificationStatus:String(e.verification_status??"PENDING"),createdAt:new Date(String(e.created_at)),updatedAt:new Date(String(e.updated_at))}}async function u(e,t){let i=await e.query("SELECT id FROM therapist_profiles WHERE user_id = $1 LIMIT 1",[t.userId]),a=i.rows[0]?.id??t.id??(0,n.randomUUID)(),s=await e.query(`
      INSERT INTO therapist_profiles (
        id, user_id, job_type, license_number, license_file_url,
        issued_by, issued_date, specialty, introduction,
        is_public, verification_status,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
      SET
        job_type = EXCLUDED.job_type,
        license_number = EXCLUDED.license_number,
        license_file_url = EXCLUDED.license_file_url,
        issued_by = EXCLUDED.issued_by,
        issued_date = EXCLUDED.issued_date,
        specialty = EXCLUDED.specialty,
        introduction = EXCLUDED.introduction,
        is_public = EXCLUDED.is_public,
        verification_status = EXCLUDED.verification_status,
        updated_at = NOW()
      RETURNING *
    `,[a,t.userId,t.jobType,t.licenseNumber,t.licenseFileUrl,t.issuedBy??null,t.issuedDate??null,t.specialty??null,t.introduction??null,t.isPublic??!1,t.verificationStatus??"PENDING"]);return r(s.rows[0])}async function l(e,t){let i=await e.query("SELECT * FROM therapist_profiles WHERE user_id = $1 LIMIT 1",[t]);return i.rows[0]?r(i.rows[0]):null}async function d(e,t,i){await e.query(`UPDATE therapist_profiles
        SET verification_status = $1, updated_at = NOW()
      WHERE id = $2`,[i,t])}[a]=s.then?(await s)():s,e.s(["getTherapistProfileByUserId",()=>l,"setTherapistVerificationStatus",()=>d,"upsertTherapistProfile",()=>u]),i()}catch(e){i(e)}},!1),56555,e=>e.a(async(t,i)=>{try{var n=e.i(54799),a=e.i(63528),s=t([a]);function r(e){return{id:String(e.id),name:String(e.name??""),businessNumber:e.business_number?String(e.business_number):null,representativeName:e.representative_name?String(e.representative_name):null,institutionType:e.institution_type?String(e.institution_type):null,medicalOrgNumber:e.medical_org_number?String(e.medical_org_number):null,phone:e.phone?String(e.phone):null,zipCode:e.zip_code?String(e.zip_code):null,address1:e.address1?String(e.address1):null,address2:e.address2?String(e.address2):null,businessLicenseFileUrl:e.business_license_file_url?String(e.business_license_file_url):null,openingLicenseFileUrl:e.opening_license_file_url?String(e.opening_license_file_url):null,status:String(e.status??"PENDING"),createdByUserId:e.created_by_user_id?String(e.created_by_user_id):null,legacyOrganizationId:e.legacy_organization_id?String(e.legacy_organization_id):null,legacyOrganizationCode:e.legacy_organization_code?String(e.legacy_organization_code):null,createdAt:new Date(String(e.created_at)),updatedAt:new Date(String(e.updated_at))}}async function u(e,t){let i=t.id;if(!i&&t.legacyOrganizationId){let n=await e.query("SELECT id FROM institutions WHERE legacy_organization_id = $1 LIMIT 1",[t.legacyOrganizationId]);i=n.rows[0]?.id}i||(i=(0,n.randomUUID)());let a=await e.query(`
      INSERT INTO institutions (
        id, name, business_number, representative_name, institution_type,
        medical_org_number, phone, zip_code, address1, address2,
        business_license_file_url, opening_license_file_url,
        status, created_by_user_id,
        legacy_organization_id, legacy_organization_code,
        created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11,$12,
        $13,$14,
        $15,$16,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE
      SET
        name = EXCLUDED.name,
        business_number = EXCLUDED.business_number,
        representative_name = EXCLUDED.representative_name,
        institution_type = EXCLUDED.institution_type,
        medical_org_number = EXCLUDED.medical_org_number,
        phone = EXCLUDED.phone,
        zip_code = EXCLUDED.zip_code,
        address1 = EXCLUDED.address1,
        address2 = EXCLUDED.address2,
        business_license_file_url = EXCLUDED.business_license_file_url,
        opening_license_file_url = EXCLUDED.opening_license_file_url,
        status = EXCLUDED.status,
        created_by_user_id = COALESCE(EXCLUDED.created_by_user_id, institutions.created_by_user_id),
        legacy_organization_id = COALESCE(EXCLUDED.legacy_organization_id, institutions.legacy_organization_id),
        legacy_organization_code = COALESCE(EXCLUDED.legacy_organization_code, institutions.legacy_organization_code),
        updated_at = NOW()
      RETURNING *
    `,[i,t.name,t.businessNumber??null,t.representativeName??null,t.institutionType??null,t.medicalOrgNumber??null,t.phone??null,t.zipCode??null,t.address1??null,t.address2??null,t.businessLicenseFileUrl??null,t.openingLicenseFileUrl??null,t.status??"PENDING",t.createdByUserId??null,t.legacyOrganizationId??null,t.legacyOrganizationCode??null]);return r(a.rows[0])}async function l(e,t){let i=await e.query("SELECT * FROM institutions WHERE legacy_organization_id = $1 LIMIT 1",[t]);return i.rows[0]?r(i.rows[0]):null}[a]=s.then?(await s)():s,e.s(["getInstitutionByLegacyId",()=>l,"upsertInstitution",()=>u]),i()}catch(e){i(e)}},!1),92599,e=>e.a(async(t,i)=>{try{var n=e.i(54799),a=e.i(63528),s=t([a]);async function r(e,t){var i;let a=t.id??(0,n.randomUUID)();return i=(await e.query(`
      INSERT INTO institution_members (
        id, institution_id, user_id, role, status, is_owner, joined_at, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
      ON CONFLICT (institution_id, user_id, role) DO UPDATE
      SET
        status = EXCLUDED.status,
        is_owner = EXCLUDED.is_owner,
        joined_at = COALESCE(EXCLUDED.joined_at, institution_members.joined_at)
      RETURNING *
    `,[a,t.institutionId,t.userId,t.role,t.status??"PENDING",t.isOwner??!1,t.joinedAt??null])).rows[0],{id:String(i.id),institutionId:String(i.institution_id),userId:String(i.user_id),role:String(i.role),status:String(i.status??"PENDING"),isOwner:!!i.is_owner,joinedAt:i.joined_at?new Date(String(i.joined_at)):null,createdAt:new Date(String(i.created_at))}}[a]=s.then?(await s)():s,e.s(["upsertInstitutionMember",()=>r]),i()}catch(e){i(e)}},!1),77058,e=>e.a(async(t,i)=>{try{var n=e.i(54799),a=e.i(63528),s=t([a]);function r(e){return{id:String(e.id),userId:String(e.user_id),therapistUserId:String(e.therapist_user_id),institutionId:String(e.institution_id),status:String(e.status??"PENDING"),assignedAt:e.assigned_at?new Date(String(e.assigned_at)):null,endedAt:e.ended_at?new Date(String(e.ended_at)):null,createdAt:new Date(String(e.created_at))}}async function u(e,t){let i=await e.query(`SELECT id FROM user_therapist_mappings
      WHERE user_id = $1
        AND therapist_user_id = $2
        AND institution_id = $3
      LIMIT 1`,[t.userId,t.therapistUserId,t.institutionId]);if(i.rows[0]?.id){let n=String(i.rows[0].id),a=await e.query(`UPDATE user_therapist_mappings
          SET status = COALESCE($1, status),
              assigned_at = COALESCE($2, assigned_at),
              ended_at = COALESCE($3, ended_at)
        WHERE id = $4
        RETURNING *`,[t.status??null,t.assignedAt??null,t.endedAt??null,n]);return r(a.rows[0])}let a=t.id??(0,n.randomUUID)(),s=await e.query(`
      INSERT INTO user_therapist_mappings (
        id, user_id, therapist_user_id, institution_id,
        status, assigned_at, ended_at, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
      RETURNING *
    `,[a,t.userId,t.therapistUserId,t.institutionId,t.status??"PENDING",t.assignedAt??null,t.endedAt??null]);return r(s.rows[0])}[a]=s.then?(await s)():s,e.s(["upsertUserTherapistMapping",()=>u]),i()}catch(e){i(e)}},!1),86195,e=>e.a(async(t,i)=>{try{var n=e.i(63528),a=t([n]);async function s(e,t,i){let n=await e.query(`
      UPDATE patient_pseudonym_map
         SET user_id = $1
       WHERE patient_pseudonym_id = $2
    `,[i,t]);if(0===n.rowCount)throw Error("pseudonym_map_not_found")}async function r(e){let t=(0,n.getDbPool)(),i=await t.query("SELECT patient_pseudonym_id FROM patient_pseudonym_map WHERE patient_id = $1 LIMIT 1",[e]);return i.rows[0]?.patient_pseudonym_id?String(i.rows[0].patient_pseudonym_id):null}[n]=a.then?(await a)():a,e.s(["getPseudonymIdByLegacyPatientId",()=>r,"linkPseudonymToNewUser",()=>s]),i()}catch(e){i(e)}},!1),79324,e=>e.a(async(t,i)=>{try{var n=e.i(54799),a=e.i(63528),s=e.i(75431),r=e.i(99128),u=e.i(80471),l=e.i(95100),d=e.i(56555),o=e.i(92599),_=e.i(77058),c=e.i(86195),g=t([a,r,u,l,d,o,_,c]);async function E(e){let t=(0,a.getDbPool)(),i=await t.connect();try{if(await i.query("BEGIN"),await (0,r.upsertNewUser)(i,{id:e.userId,name:e.name,email:e.email,phone:e.phone,loginId:e.loginId,passwordHash:e.passwordHash,loginKeyHash:e.loginKeyHash??null,accountType:e.accountType,status:e.status??"PENDING",legacyUserRole:e.legacyUserRole}),await (0,u.upsertUserPiiProfile)(i,{userId:e.userId,birthDate:e.birthDate??null,sex:e.sex??null,language:e.language??null,legacyPatientCode:e.legacyPatientCode??null,legacyPatientId:e.legacyPatientId||null}),e.patientPseudonymId)try{await (0,c.linkPseudonymToNewUser)(i,e.patientPseudonymId,e.userId)}catch(t){if(t instanceof Error&&"pseudonym_map_not_found"!==t.message)throw t;console.warn("[mirror] pseudonym_map row not found, skipping link:",e.patientPseudonymId)}if(e.therapist&&await (0,l.upsertTherapistProfile)(i,{userId:e.userId,jobType:e.therapist.jobType,licenseNumber:e.therapist.licenseNumber,licenseFileUrl:e.therapist.licenseFileUrl||"pending",issuedBy:e.therapist.issuedBy??null,issuedDate:e.therapist.issuedDate??null,specialty:e.therapist.specialty??null,introduction:e.therapist.introduction??null,isPublic:!1,verificationStatus:"PENDING"}),e.existingLegacyOrganizationId){let t=e.existingLegacyOrganizationId,n=await (0,d.getInstitutionByLegacyId)(i,t)??await (0,d.upsertInstitution)(i,{name:`(legacy:${t.slice(0,8)})`,status:"APPROVED",legacyOrganizationId:t,createdByUserId:e.userId}),a="THERAPIST"===e.accountType?"THERAPIST":"USER"===e.accountType?"PATIENT":"MANAGER";await (0,o.upsertInstitutionMember)(i,{institutionId:n.id,userId:e.userId,role:a,status:"ACTIVE"===e.status?"APPROVED":"PENDING",isOwner:!1,joinedAt:"ACTIVE"===e.status?new Date:null})}if(e.soloInstitution){let t=(0,n.randomUUID)(),a=await (0,d.upsertInstitution)(i,{id:t,name:e.soloInstitution.name,businessNumber:e.soloInstitution.businessNumber??null,representativeName:e.soloInstitution.representativeName??null,institutionType:e.soloInstitution.institutionType??null,phone:e.soloInstitution.phone??null,zipCode:e.soloInstitution.zipCode??null,address1:e.soloInstitution.address1??null,address2:e.soloInstitution.address2??null,businessLicenseFileUrl:e.soloInstitution.businessLicenseFileUrl??null,status:"PENDING",createdByUserId:e.userId});await (0,o.upsertInstitutionMember)(i,{institutionId:a.id,userId:e.userId,role:"OWNER",status:"PENDING",isOwner:!0,joinedAt:null})}await i.query("COMMIT")}catch(e){throw await i.query("ROLLBACK"),e}finally{i.release()}}async function p(e){let t=(0,a.getDbPool)(),i=await t.connect();try{await i.query("BEGIN");let t="approved"===e.status?"ACTIVE":"SUSPENDED";await i.query("UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2",[t,e.therapistUserId]);let n=await (0,l.getTherapistProfileByUserId)(i,e.therapistUserId);if(n){let t="approved"===e.status?"APPROVED":"REJECTED";await (0,l.setTherapistVerificationStatus)(i,n.id,t)}await i.query("COMMIT")}catch(e){throw await i.query("ROLLBACK"),e}finally{i.release()}}async function y(e){let t=(0,a.getDbPool)(),i=await t.connect();try{await i.query("BEGIN");let t=null;if(e.legacyOrganizationId){let n=await (0,d.getInstitutionByLegacyId)(i,e.legacyOrganizationId);t=n?.id??null}if(t?await i.query(`
          UPDATE institutions
             SET name = $1,
                 business_number = COALESCE($2, business_number),
                 representative_name = COALESCE($3, representative_name),
                 institution_type = COALESCE($4, institution_type),
                 phone = COALESCE($5, phone),
                 zip_code = COALESCE($6, zip_code),
                 address1 = COALESCE($7, address1),
                 address2 = COALESCE($8, address2),
                 business_license_file_url = COALESCE($9, business_license_file_url),
                 status = $10,
                 updated_at = NOW()
           WHERE id = $11
        `,[e.name,e.businessNumber??null,e.representativeName??null,e.institutionType??null,e.phone??null,e.zipCode??null,e.address1??null,e.address2??null,e.businessLicenseFileUrl??null,e.status,t]):await (0,d.upsertInstitution)(i,{name:e.name,businessNumber:e.businessNumber??null,representativeName:e.representativeName??null,institutionType:e.institutionType??null,phone:e.phone??null,zipCode:e.zipCode??null,address1:e.address1??null,address2:e.address2??null,businessLicenseFileUrl:e.businessLicenseFileUrl??null,status:e.status,legacyOrganizationId:e.legacyOrganizationId??null}),e.legacyOrganizationId){let t=await (0,d.getInstitutionByLegacyId)(i,e.legacyOrganizationId);if(t){let n="APPROVED"===e.status?"APPROVED":"REJECTED";await i.query(`
            UPDATE institution_members
               SET status = $1,
                   joined_at = CASE WHEN $1 = 'APPROVED' AND joined_at IS NULL THEN NOW() ELSE joined_at END
             WHERE institution_id = $2
               AND status = 'PENDING'
          `,[n,t.id])}}await i.query("COMMIT")}catch(e){throw await i.query("ROLLBACK"),e}finally{i.release()}}async function I(e){let t=(0,a.getDbPool)(),i=await t.connect();try{await i.query("BEGIN");let t=await (0,d.getInstitutionByLegacyId)(i,e.legacyOrganizationId);t||(t=await (0,d.upsertInstitution)(i,{name:`(legacy:${e.legacyOrganizationId.slice(0,8)})`,status:"APPROVED",legacyOrganizationId:e.legacyOrganizationId}));let n=await i.query("SELECT id FROM users WHERE id IN ($1, $2)",[e.patientUserId,e.therapistUserId]);if(2!==n.rowCount){console.warn("[mirror] patient-link skip: users row missing (likely pre-dual-write account)"),await i.query("COMMIT");return}await (0,_.upsertUserTherapistMapping)(i,{userId:e.patientUserId,therapistUserId:e.therapistUserId,institutionId:t.id,status:"approved"===e.status?"APPROVED":"REJECTED",assignedAt:"approved"===e.status?new Date:null}),await i.query("COMMIT")}catch(e){throw await i.query("ROLLBACK"),e}finally{i.release()}}async function D(e,t){if(s.featureFlags.useNewUsersSchema)try{await t()}catch(i){let t=i instanceof Error?i.message:String(i);if(console.error(`[dual-write][${e}] mirror failed:`,t),s.featureFlags.useNewUsersSchemaStrict)throw i}}[a,r,u,l,d,o,_,c]=g.then?(await g)():g,e.s(["mirrorAccountSignup",()=>E,"mirrorOrganizationReview",()=>y,"mirrorPatientLinkApproval",()=>I,"mirrorTherapistReview",()=>p,"runMirrorGuarded",()=>D]),i()}catch(e){i(e)}},!1)];

//# sourceMappingURL=src_lib_server_9cf1262a._.js.map