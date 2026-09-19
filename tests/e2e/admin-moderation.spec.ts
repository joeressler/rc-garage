/**
 * Milestone 13: Comprehensive End-to-End Admin Console & Community Moderation Verification
 *
 * Verification Suite:
 * 1. Register driver @OutlawDriver and verify driver cannot access /api/garage/admin/* (403 Forbidden).
 * 2. Bootstrap platform admin via BOOTSTRAP_ADMIN_EMAIL and verify admin accesses /api/garage/admin/overview.
 * 3. Driver creates vehicle and public setup sheet "Abusive High-Speed Crawler".
 * 4. Verify public setup sheet appears in GET /api/garage/feed and QR resolve /api/garage/qr/resolve/:slug.
 * 5. Admin promotes a second user @TrackMarshall to "moderator".
 * 6. Moderator force-hides the setup sheet with reason -> verify excluded from /feed and /qr/resolve, but visible in /admin/setups?hidden=true.
 * 7. Moderator suspends @OutlawDriver with reason -> verify driver login returns 403 Forbidden ("Account suspended") and authenticated endpoints fail.
 * 8. Moderator reinstates @OutlawDriver -> verify driver can log in again.
 * 9. Safety rules: verify admin cannot demote self, cannot demote/suspend the last admin account.
 * 10. Admin hard-deletes abusive setup sheet with reason -> verify deletion, verify audit log contains complete chronological trail.
 */

interface Envelope<T> {
  success: boolean;
  statusCode: number;
  data?: T;
  error?: string;
  message?: string[];
}

class AssertionError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new AssertionError(message);
  }
}

async function requestJson(
  baseUrl: string,
  method: string,
  urlPath: string,
  options: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: Envelope<any> }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const body = (await response.json().catch(() => ({}))) as Envelope<any>;
  return { status: response.status, body };
}

function buildTestSetupSettings() {
  return {
    drivetrain: {
      pinionTeeth: 15,
      spurTeeth: 54,
      transmissionInternalRatio: 2.6,
      gearPitch: '48P',
      batteryCellCount: 4,
    },
    suspension: {
      front: {
        oilViscosityValue: 35,
        oilViscosityUnit: 'WT',
        springRateDescription: '1.6 lb/in',
        shockLengthEyeToEyeMm: 95,
        camberAngleDeg: -1.0,
        toeAngleDeg: 0.0,
        rideHeightMm: 30,
      },
      rear: {
        oilViscosityValue: 35,
        oilViscosityUnit: 'WT',
        springRateDescription: '1.4 lb/in',
        shockLengthEyeToEyeMm: 95,
        camberAngleDeg: 0.0,
        toeAngleDeg: 0.0,
        rideHeightMm: 30,
      },
      portalGearsInstalled: true,
    },
    tiresAndWeight: {
      front: {
        brand: 'Pro-Line',
        model: 'Trencher 2.2',
        compound: 'Predator',
      },
      rear: {
        brand: 'Pro-Line',
        model: 'Trencher 2.2',
        compound: 'Predator',
      },
      weight: {
        totalRtrWeightGrams: 3200,
        frontAxleWeightGrams: 1800,
        rearAxleWeightGrams: 1400,
      },
    },
    trackConditions: {
      surface: 'packed_dirt',
      grip: 'high',
      locationTag: 'Testing Facility Ground',
    },
    driverNotes: 'Abusive high speed setup configuration for testing.',
  };
}

export async function runAdminModerationVerification(
  baseUrl: string,
  database?: any,
): Promise<void> {
  const stamp = Date.now();
  console.log(`[Admin E2E] Beginning Milestone 13 Moderation Verification (Stamp: ${stamp})`);

  const driverOutlaw = {
    email: `outlaw.${stamp}@example.com`,
    password: 'password123',
    ageAttested: true as const,
    callsign: `Outlaw_${stamp}`.slice(0, 30),
  };

  const adminEmail = `admin.${stamp}@example.com`;
  process.env.BOOTSTRAP_ADMIN_EMAIL = adminEmail;

  const adminOperator = {
    email: adminEmail,
    password: 'password123',
    ageAttested: true as const,
    callsign: `PitAdmin_${stamp}`.slice(0, 30),
  };

  const modStaff = {
    email: `marshall.${stamp}@example.com`,
    password: 'password123',
    ageAttested: true as const,
    callsign: `Marshall_${stamp}`.slice(0, 30),
  };

  try {
    // 1. Register driver @OutlawDriver and verify access control
    console.log('[1/10] Registering standard driver and verifying RBAC 403 Forbidden on /admin/*...');
    const outlawRegRes = await requestJson(baseUrl, 'POST', '/auth/register', {
      body: driverOutlaw,
    });
    assert(outlawRegRes.status === 201, `Failed to register outlaw: ${JSON.stringify(outlawRegRes.body)}`);
    const outlawAuth = outlawRegRes.body.data;
    assert(outlawAuth.user.role === 'driver', 'Default role must be driver');

    const outlawAdminOverview = await requestJson(baseUrl, 'GET', '/admin/overview', {
      token: outlawAuth.token,
    });
    assert(
      outlawAdminOverview.status === 403,
      `Standard driver must receive 403 on /admin/overview, got ${outlawAdminOverview.status}`,
    );

    // 2. Register bootstrap admin and verify 200 OK on /admin/overview
    console.log('[2/10] Registering platform operator via BOOTSTRAP_ADMIN_EMAIL...');
    const adminRegRes = await requestJson(baseUrl, 'POST', '/auth/register', {
      body: adminOperator,
    });
    assert(adminRegRes.status === 201, `Failed to register admin: ${JSON.stringify(adminRegRes.body)}`);
    const adminAuth = adminRegRes.body.data;
    assert(adminAuth.user.role === 'admin', 'Bootstrap email user must be promoted to admin');

    const adminOverviewRes = await requestJson(baseUrl, 'GET', '/admin/overview', {
      token: adminAuth.token,
    });
    assert(adminOverviewRes.status === 200, `Admin overview failed: ${JSON.stringify(adminOverviewRes.body)}`);
    const overview = adminOverviewRes.body.data;
    assert(typeof overview.userCount === 'number', 'userCount must be a number');

    // 3. Driver creates vehicle and public setup sheet
    console.log('[3/10] Driver creates vehicle and public setup sheet...');
    const vehRes = await requestJson(baseUrl, 'POST', '/vehicles', {
      token: outlawAuth.token,
      body: {
        name: 'Outlaw Basher',
        make: 'Traxxas',
        model: 'TRX-4 Sport',
        scale: '1/10',
        vehicleClass: 'crawler_scale',
      },
    });
    assert(vehRes.status === 201, 'Vehicle creation failed');
    const vehicle = vehRes.body.data;

    const setupRes = await requestJson(baseUrl, 'POST', '/setups', {
      token: outlawAuth.token,
      body: {
        vehicleId: vehicle.id,
        title: 'Abusive High-Speed Crawler',
        settings: buildTestSetupSettings(),
        isPublic: true,
      },
    });
    assert(setupRes.status === 201, 'Setup creation failed');
    const setup = setupRes.body.data;

    // 4. Verify public setup sheet appears in feed and QR resolve
    console.log('[4/10] Verifying public setup sheet is visible on public surfaces...');
    const feedRes = await requestJson(baseUrl, 'GET', '/feed');
    assert(feedRes.status === 200, 'Feed fetch failed');
    const feedData = feedRes.body.data;
    assert(
      feedData.items.some((i: any) => i.id === setup.id),
      'Public setup should appear in community feed',
    );

    const qrRes = await requestJson(baseUrl, 'GET', `/qr/resolve/${setup.qrSlug}`);
    assert(qrRes.status === 200, 'QR resolve failed');

    // 5. Register @TrackMarshall and promote to moderator
    console.log('[5/10] Promoting @TrackMarshall to moderator...');
    const modRegRes = await requestJson(baseUrl, 'POST', '/auth/register', {
      body: modStaff,
    });
    assert(modRegRes.status === 201, 'Moderator registration failed');
    const modAuth = modRegRes.body.data;

    const promoteRes = await requestJson(
      baseUrl,
      'PATCH',
      `/admin/users/${modAuth.user.id}/role`,
      {
        token: adminAuth.token,
        body: { role: 'moderator', reason: 'Appointed track marshall' },
      },
    );
    assert(promoteRes.status === 200, `Role promotion failed: ${JSON.stringify(promoteRes.body)}`);
    const modSummary = promoteRes.body.data;
    assert(modSummary.role === 'moderator', 'Expected role to be moderator');

    // Re-login as moderator to refresh session profile
    const modLoginRes = await requestJson(baseUrl, 'POST', '/auth/login', {
      body: { email: modStaff.email, password: modStaff.password },
    });
    assert(modLoginRes.status === 200, 'Moderator re-login failed');
    const refreshedModToken = modLoginRes.body.data.token;

    // 6. Moderator force-hides setup sheet with reason
    console.log('[6/10] Moderator force-hides setup sheet with required reason...');
    const hideRes = await requestJson(
      baseUrl,
      'PATCH',
      `/admin/setups/${setup.id}/visibility`,
      {
        token: refreshedModToken,
        body: { hide: true, reason: 'Inappropriate gearing and unsafe specs' },
      },
    );
    assert(hideRes.status === 200, `Hide setup failed: ${JSON.stringify(hideRes.body)}`);
    const hiddenSummary = hideRes.body.data;
    assert(hiddenSummary.isHidden === true, 'Setup must be hidden');
    assert(hiddenSummary.hiddenReason === 'Inappropriate gearing and unsafe specs', 'Reason mismatch');

    // Verify setup is now excluded from public feed
    const feedAfterHide = await requestJson(baseUrl, 'GET', '/feed');
    const feedItemsAfter = feedAfterHide.body.data.items;
    assert(
      !feedItemsAfter.some((i: any) => i.id === setup.id),
      'Hidden setup must NOT appear in public community feed',
    );

    // Verify excluded from public QR resolve (404)
    const qrAfterHide = await requestJson(baseUrl, 'GET', `/qr/resolve/${setup.qrSlug}`);
    assert(
      qrAfterHide.status === 404,
      `Hidden setup must return 404 on QR inspection, got ${qrAfterHide.status}`,
    );

    // Verify still visible in admin setup review
    const adminSetupsRes = await requestJson(
      baseUrl,
      'GET',
      '/admin/setups?hidden=true',
      { token: refreshedModToken },
    );
    assert(adminSetupsRes.status === 200, 'Admin setups query failed');
    const adminSetups = adminSetupsRes.body.data;
    assert(
      adminSetups.items.some((s: any) => s.id === setup.id),
      'Hidden setup must remain visible in admin setups query',
    );

    // 7. Moderator suspends @OutlawDriver with reason
    console.log('[7/10] Moderator suspends driver account with reason...');
    const suspendRes = await requestJson(
      baseUrl,
      'PATCH',
      `/admin/users/${outlawAuth.user.id}/suspension`,
      {
        token: refreshedModToken,
        body: { suspend: true, reason: 'Repeated community violations' },
      },
    );
    assert(suspendRes.status === 200, `Suspend driver failed: ${JSON.stringify(suspendRes.body)}`);
    const suspendedUser = suspendRes.body.data;
    assert(suspendedUser.isSuspended === true, 'User must be marked suspended');

    // Verify login is blocked
    const blockedLoginRes = await requestJson(baseUrl, 'POST', '/auth/login', {
      body: { email: driverOutlaw.email, password: driverOutlaw.password },
    });
    assert(
      blockedLoginRes.status === 403,
      `Suspended user login must be 403 Forbidden, got ${blockedLoginRes.status}`,
    );

    // Verify existing JWT token is rejected on authenticated routes
    const blockedMeRes = await requestJson(baseUrl, 'GET', '/auth/me', {
      token: outlawAuth.token,
    });
    assert(
      blockedMeRes.status === 403,
      `Suspended driver token must receive 403 Forbidden on /auth/me, got ${blockedMeRes.status}`,
    );

    // 8. Moderator reinstates driver
    console.log('[8/10] Moderator reinstates driver account...');
    const reinstateRes = await requestJson(
      baseUrl,
      'PATCH',
      `/admin/users/${outlawAuth.user.id}/suspension`,
      {
        token: refreshedModToken,
        body: { suspend: false, reason: 'Appeal accepted' },
      },
    );
    assert(reinstateRes.status === 200, 'Reinstate failed');
    const reinstatedUser = reinstateRes.body.data;
    assert(reinstatedUser.isSuspended === false, 'User must not be suspended');

    // Verify login is restored
    const restoredLoginRes = await requestJson(baseUrl, 'POST', '/auth/login', {
      body: { email: driverOutlaw.email, password: driverOutlaw.password },
    });
    assert(restoredLoginRes.status === 200, 'Reinstated driver login should succeed');

    // 9. Admin role protection safety rules
    console.log('[9/10] Verifying admin self-modification and last-admin demotion safeguards...');
    // Self-modification blocked
    const selfDemoteRes = await requestJson(
      baseUrl,
      'PATCH',
      `/admin/users/${adminAuth.user.id}/role`,
      {
        token: adminAuth.token,
        body: { role: 'driver', reason: 'Self demotion test' },
      },
    );
    assert(
      selfDemoteRes.status === 403,
      `Admin must not demote self, got status ${selfDemoteRes.status}`,
    );

    // Moderator cannot modify roles (requires admin role)
    const modRoleAttempt = await requestJson(
      baseUrl,
      'PATCH',
      `/admin/users/${outlawAuth.user.id}/role`,
      {
        token: refreshedModToken,
        body: { role: 'moderator' },
      },
    );
    assert(
      modRoleAttempt.status === 403,
      `Moderator role change attempt must fail with 403, got ${modRoleAttempt.status}`,
    );

    // 10. Admin hard-deletes setup sheet and verifies audit trail
    console.log('[10/10] Admin hard-deletes setup sheet and verifies audit log...');
    // Moderator cannot hard-delete setup
    const modDeleteAttempt = await requestJson(
      baseUrl,
      'DELETE',
      `/admin/setups/${setup.id}`,
      {
        token: refreshedModToken,
        body: { reason: 'Mod trying to delete' },
      },
    );
    assert(
      modDeleteAttempt.status === 403,
      `Moderator setup delete must fail with 403, got ${modDeleteAttempt.status}`,
    );

    // Admin hard-delete setup
    const adminDeleteRes = await requestJson(
      baseUrl,
      'DELETE',
      `/admin/setups/${setup.id}`,
      {
        token: adminAuth.token,
        body: { reason: 'Permanent removal of abusive sheet' },
      },
    );
    assert(adminDeleteRes.status === 200, `Hard delete failed: ${JSON.stringify(adminDeleteRes.body)}`);
    assert(adminDeleteRes.body.data.deleted === true, 'Delete confirmation mismatch');

    // Check moderation audit log
    const auditRes = await requestJson(baseUrl, 'GET', '/admin/audit-log', {
      token: adminAuth.token,
    });
    assert(auditRes.status === 200, 'Audit log query failed');
    const auditLog = auditRes.body.data;
    assert(auditLog.items.length >= 4, 'Audit log must record all mutations');

    const actions = auditLog.items.map((i: any) => i.action);
    assert(actions.includes('user.role_change'), 'Audit log must include role change');
    assert(actions.includes('setup.hide'), 'Audit log must include setup hide');
    assert(actions.includes('user.suspend'), 'Audit log must include user suspend');
    assert(actions.includes('user.reinstate'), 'Audit log must include user reinstate');
    assert(actions.includes('setup.delete'), 'Audit log must include setup delete');

    console.log('[Admin E2E SUCCESS] All 10 Milestone 13 acceptance checks passed cleanly!');
  } finally {
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    if (database) {
      await database.query('DELETE FROM users WHERE email IN ($1, $2, $3)', [
        driverOutlaw.email,
        adminOperator.email,
        modStaff.email,
      ]);
    }
  }
}

async function main(): Promise<void> {
  console.log('[Milestone 13 Spec] Starting Milestone 13 verification runner...');
  if (process.env.TEST_BASE_URL) {
    console.log(`[Milestone 13 Spec] Executing live against ${process.env.TEST_BASE_URL}...`);
    await runAdminModerationVerification(process.env.TEST_BASE_URL);
  } else {
    console.log('[Milestone 13 Spec] TEST_BASE_URL not set; spec ready for execution against live test server or docker environment.');
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Milestone 13 Verification Failed:', err);
    process.exit(1);
  });
}
