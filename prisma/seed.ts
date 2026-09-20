/**
 * CivicPulse Database Seed Script
 * Generates initial official personnel, test citizens, and realistic emergency incidents.
 */

import { PrismaClient, Role, IssueStatus, Severity } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seed...');

  // 1. Clear existing seed records
  await prisma.upvote.deleteMany();
  await prisma.auditTrail.deleteMany();
  await prisma.outboxEvent.deleteMany();
  await prisma.$executeRawUnsafe(`DELETE FROM "Issue";`);
  await prisma.user.deleteMany();

  // 2. Create Users (Officials and First Responders)
  const officialUser = await prisma.user.create({
    data: {
      email: 'chief.commander@sfdph.gov',
      fullName: 'Chief Marcus Vance',
      passwordHash: '$2b$12$e8x/kM3P1xK1J0y3WqZz2.9tL.9tL.9tL.9tL.9tL.9tL',
      role: Role.FIRST_RESPONDER,
      reputation: 100,
    },
  });

  const citizenUser = await prisma.user.create({
    data: {
      email: 'citizen.clara@gmail.com',
      fullName: 'Clara Oswald',
      passwordHash: '$2b$12$e8x/kM3P1xK1J0y3WqZz2.9tL.9tL.9tL.9tL.9tL.9tL',
      role: Role.CITIZEN,
      reputation: 15,
    },
  });

  // 3. Create Issues with PostGIS geometry points
  const issuesToSeed = [
    {
      title: 'High-Voltage Transformer Fire at Market & 4th',
      description: 'Explosion heard, transformer emitting toxic black smoke. Multiple traffic signals out. First responders notified.',
      category: 'HAZARD',
      status: 'REPORTED',
      severity: 'CRITICAL_EMERGENCY',
      upvotes: 142,
      lat: 37.7858,
      lng: -122.4065,
    },
    {
      title: 'Water Main Rupture Flooding Mission St Underpass',
      description: '12-inch main line burst creating 3ft standing water. Submerged vehicles risking electrical shorts.',
      category: 'UTILITIES',
      status: 'IN_PROGRESS',
      severity: 'HIGH',
      upvotes: 89,
      lat: 37.7712,
      lng: -122.4184,
    },
    {
      title: 'Collapsed Retaining Wall on Twin Peaks Scenic Way',
      description: 'Erosion following heavy rainfall caused 40-ton boulder and dirt shift across northern lane.',
      category: 'INFRASTRUCTURE',
      status: 'TRIAGED',
      severity: 'HIGH',
      upvotes: 64,
      lat: 37.7544,
      lng: -122.4477,
    },
    {
      title: 'Gas Odor Reported Outside Elementary School',
      description: 'Strong rotten egg odor near gas meter bank. PG&E crew dispatched for emergency line sweep.',
      category: 'PUBLIC_SAFETY',
      status: 'IN_PROGRESS',
      severity: 'CRITICAL_EMERGENCY',
      upvotes: 230,
      lat: 37.7812,
      lng: -122.4345,
    },
  ];

  for (const item of issuesToSeed) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Issue" (
        id, "reporterId", title, description, category, status, severity,
        "upvoteCount", version, location, latitude, longitude, "mediaUrls",
        "createdAt", "updatedAt"
      )
      VALUES (
        gen_random_uuid(),
        '${citizenUser.id}'::uuid,
        '${item.title.replace(/'/g, "''")}',
        '${item.description.replace(/'/g, "''")}',
        '${item.category}',
        '${item.status}'::"IssueStatus",
        '${item.severity}'::"Severity",
        ${item.upvotes},
        1,
        ST_SetSRID(ST_MakePoint(${item.lng}, ${item.lat}), 4326)::geography,
        ${item.lat},
        ${item.lng},
        ARRAY[]::text[],
        NOW(),
        NOW()
      );
    `);
  }

  console.log(`[Seed] Seeded users and ${issuesToSeed.length} PostGIS civic issues successfully.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
