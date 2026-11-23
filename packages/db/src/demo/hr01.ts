// The HR-01 demo tenant: a Rabat company with 148 people, their contracts, their
// documents and the checklists behind them (docs/specs/HR-01-demo-build-spec.md).
//
// INVENTED DATA ONLY (CLAUDE.md rule 6). Every person, identifier, bank account
// and salary here is made up. SMG's own data arrives only after the data template
// is agreed, and never in this repository.
//
// Deterministic: the same seed produces the same 148 people, in the same order,
// with the same numbers, every time. That is what makes the demo repeatable and
// "Reset demo data" meaningful — and what lets a test assert on a given person.

import type { CPeoplePrismaClient } from '../client.js';
import { clearHr02Leave, seedHr02Leave, type LeaveSeedCounts } from './hr02.js';

/**
 * The day the demo is given, and the day every date here is measured from: the
 * contracts that end "this week", the documents expiring "in 30 days" and the
 * people starting "next month" are all relative to it.
 */
export const DEMO_TODAY = '2026-11-23';

/** Fixed, so the generator is a function of nothing but this number. */
const SEED = 0x5c_9e_01;

const DEPARTMENTS = [
  { code: 'KIT', name: 'Kitchen', headcount: 46, site: 'KITCHEN', costCentre: 'CC-KIT' },
  { code: 'OUT', name: 'Outlet', headcount: 38, site: 'OUTLET', costCentre: 'CC-OUT' },
  { code: 'PAS', name: 'Pastry', headcount: 29, site: 'PASTRY', costCentre: 'CC-PAS' },
  { code: 'ADM', name: 'Administration', headcount: 20, site: 'HEAD', costCentre: 'CC-ADM' },
  { code: 'WAR', name: 'Warehouse', headcount: 15, site: 'WAREHOUSE', costCentre: 'CC-WAR' },
] as const;

const SITES = [
  { code: 'HEAD', name: 'Head office', city: 'Rabat' },
  { code: 'OUTLET', name: 'Outlet', city: 'Rabat' },
  { code: 'KITCHEN', name: 'Central kitchen', city: 'Rabat' },
  { code: 'PASTRY', name: 'Pastry workshop', city: 'Rabat' },
  { code: 'WAREHOUSE', name: 'Main warehouse', city: 'Salé' },
] as const;

/** Invented names, in the shape Moroccan names take. Nobody real is in here. */
// Kept apart so that a file reads as one person: a demo where Karim is recorded
// as a woman is one the client stops trusting at the first screen.
const GIVEN_NAMES = {
  female: [
    'Chaimae', 'Fatima', 'Ghita', 'Hanane', 'Ibtissam', 'Imane', 'Kaoutar', 'Khadija',
    'Leila', 'Malak', 'Mariam', 'Meryem', 'Nadia', 'Nawal', 'Rania', 'Safae', 'Salma',
    'Sanae', 'Sara', 'Siham', 'Wafae', 'Yasmine', 'Zineb',
  ],
  male: [
    'Amine', 'Anas', 'Ayoub', 'Bilal', 'Driss', 'Hamza', 'Hicham', 'Ismail', 'Jalil',
    'Mahdi', 'Mehdi', 'Mouad', 'Mounir', 'Nabil', 'Nizar', 'Omar', 'Oussama', 'Rachid',
    'Reda', 'Samir', 'Soufiane', 'Tarik', 'Yassine', 'Younes', 'Youssef', 'Zakaria',
  ],
} as const;

const FAMILY_NAMES = [
  'Alaoui', 'Amrani', 'Benali', 'Bennani', 'Berrada', 'Bouazza', 'Chraibi', 'Daoudi',
  'El Amrani', 'El Fassi', 'El Idrissi', 'Essaadi', 'Fassi', 'Ghazi', 'Haddad',
  'Hakimi', 'Idrissi', 'Jabri', 'Kabbaj', 'Kettani', 'Lahlou', 'Mansouri', 'Mekouar',
  'Nejjar', 'Ouazzani', 'Rachidi', 'Saidi', 'Sekkat', 'Tazi', 'Zouaoui',
] as const;

interface CastMember {
  readonly number: string;
  readonly first: string;
  readonly last: string;
  readonly department: (typeof DEPARTMENTS)[number]['code'];
  readonly gender: 'female' | 'male';
  readonly role: string;
  /** Set for the four people who also sign in, so the rows match the realm. */
  readonly email?: string;
}

/** The people the demo script names, so the screens tell one coherent story. */
const CAST: readonly CastMember[] = [
  { number: 'SMG-0001', first: 'Salma', last: 'Benali', gender: 'female', department: 'ADM', role: 'HR manager', email: 'hr@smg-demo.test' },
  { number: 'SMG-0002', first: 'Rachid', last: 'Kettani', gender: 'male', department: 'KIT', role: 'Head of kitchen', email: 'manager@smg-demo.test' },
  { number: 'SMG-0003', first: 'Karim', last: 'Alaoui', gender: 'male', department: 'KIT', role: 'Commis de cuisine', email: 'employee@smg-demo.test' },
  { number: 'SMG-0004', first: 'Leila', last: 'Fassi', gender: 'female', department: 'OUT', role: 'Sales assistant' },
  { number: 'SMG-0005', first: 'Mehdi', last: 'Idrissi', gender: 'male', department: 'PAS', role: 'Pastry chef' },
  { number: 'SMG-0006', first: 'Sara', last: 'Amrani', gender: 'female', department: 'ADM', role: 'Accountant' },
  { number: 'SMG-0007', first: 'Yassine', last: 'Tazi', gender: 'male', department: 'WAR', role: 'Storekeeper' },
  { number: 'SMG-0008', first: 'Nadia', last: 'Berrada', gender: 'female', department: 'OUT', role: 'Sales assistant' },
  { number: 'SMG-0009', first: 'Omar', last: 'Chraibi', gender: 'male', department: 'KIT', role: 'Commis de cuisine' },
];

const DOCUMENT_TYPES = [
  { code: 'CIN', name: 'National identity card', requiresExpiry: true, alertDaysBefore: 60, sensitive: true },
  { code: 'RESIDENCE', name: 'Residence permit', requiresExpiry: true, alertDaysBefore: 60, sensitive: true },
  { code: 'MEDICAL', name: 'Medical aptitude certificate', requiresExpiry: true, alertDaysBefore: 30, sensitive: true },
  { code: 'RIB', name: 'Bank details certificate', requiresExpiry: false, alertDaysBefore: 30, sensitive: true },
  { code: 'DIPLOMA', name: 'Diploma', requiresExpiry: false, alertDaysBefore: 30, sensitive: false },
  { code: 'CONTRACT', name: 'Signed contract', requiresExpiry: false, alertDaysBefore: 30, sensitive: true },
  { code: 'CNSS', name: 'Social security affiliation', requiresExpiry: false, alertDaysBefore: 30, sensitive: true },
  { code: 'PHOTO', name: 'Photograph', requiresExpiry: false, alertDaysBefore: 30, sensitive: false },
] as const;

const CONTRACT_TYPES = [
  { code: 'CDI', name: 'Contrat à durée indéterminée', requiresEndDate: false, defaultTrialDays: 90 },
  { code: 'CDD', name: 'Contrat à durée déterminée', requiresEndDate: true, defaultTrialDays: 45 },
  { code: 'ANAPEC', name: "Contrat d'insertion ANAPEC", requiresEndDate: true, defaultTrialDays: 45 },
] as const;

/**
 * The checklist a new hire goes through. Sample content: every item is a question
 * for the HR-01 workshop, not a rule we have been given.
 */
const CHECKLIST = [
  { title: 'Collect the identity document', owner: 'hr', offset: -3, document: 'CIN', departments: [] },
  { title: 'Collect the bank details', owner: 'hr', offset: -3, document: 'RIB', departments: [] },
  { title: 'Medical aptitude certificate', owner: 'hr', offset: 0, document: 'MEDICAL', departments: ['KIT', 'PAS'] },
  { title: 'Generate and sign the contract', owner: 'hr', offset: 0, document: 'CONTRACT', departments: [] },
  { title: 'Social security affiliation', owner: 'hr', offset: 7, document: 'CNSS', departments: [] },
  { title: 'Create the CPeople account', owner: 'admin', offset: 0, document: null, departments: [] },
  { title: 'Hygiene and safety induction', owner: 'manager', offset: 2, document: null, departments: ['KIT', 'PAS'] },
  { title: 'Uniform and badge', owner: 'manager', offset: 0, document: null, departments: [] },
] as const;

export interface DemoSeedResult {
  readonly employees: number;
  readonly contracts: number;
  readonly documents: number;
  readonly tasks: number;
  /** The leave set-up seeded with them (M08): types, rules, weeks, holidays. */
  readonly leave: LeaveSeedCounts;
}

/**
 * Wipes this tenant's demo data and writes it again.
 *
 * Runs as the database owner, which is the only role that may cross tenants, and
 * is therefore a command-line operation: nothing in the API can do this.
 */
export async function seedHr01Demo(
  prisma: CPeoplePrismaClient,
  tenantId: string,
  companyId: string,
): Promise<DemoSeedResult> {
  const random = mulberry32(SEED);

  await clear(prisma, tenantId);

  // --- Organisation -------------------------------------------------------
  const sites = new Map<string, string>();
  for (const site of SITES) {
    const row = await prisma.site.create({
      data: { tenantId, companyId, code: site.code, name: site.name, city: site.city },
    });
    sites.set(site.code, row.id);
  }

  const costCentres = new Map<string, string>();
  for (const department of DEPARTMENTS) {
    const row = await prisma.costCentre.create({
      data: {
        tenantId,
        companyId,
        code: department.costCentre,
        // The code in S/4HANA is deliberately empty: Finance maps it at HR-03.
        name: `${department.name} cost centre`,
      },
    });
    costCentres.set(department.costCentre, row.id);
  }

  const departments = new Map<string, string>();
  for (const department of DEPARTMENTS) {
    const row = await prisma.department.create({
      data: {
        tenantId,
        companyId,
        code: department.code,
        name: department.name,
        siteId: sites.get(department.site)!,
        costCentreId: costCentres.get(department.costCentre)!,
      },
    });
    departments.set(department.code, row.id);
  }

  // Three levels of positions per department, plus the one at the top: enough for
  // an organisation chart that is worth looking at.
  const positions = new Map<string, string>();
  const gm = await prisma.position.create({
    data: {
      tenantId,
      code: 'POS-GM',
      title: 'General manager',
      departmentId: departments.get('ADM')!,
      plannedHeadcount: 1,
    },
  });
  positions.set('POS-GM', gm.id);

  for (const department of DEPARTMENTS) {
    const head = await prisma.position.create({
      data: {
        tenantId,
        code: `POS-${department.code}-HEAD`,
        title: `Head of ${department.name.toLowerCase()}`,
        departmentId: departments.get(department.code)!,
        reportsToPositionId: gm.id,
        plannedHeadcount: 1,
      },
    });
    const supervisor = await prisma.position.create({
      data: {
        tenantId,
        code: `POS-${department.code}-SUP`,
        title: `${department.name} supervisor`,
        departmentId: departments.get(department.code)!,
        reportsToPositionId: head.id,
        plannedHeadcount: 2,
      },
    });
    const staff = await prisma.position.create({
      data: {
        tenantId,
        code: `POS-${department.code}-STAFF`,
        title: `${department.name} team member`,
        departmentId: departments.get(department.code)!,
        reportsToPositionId: supervisor.id,
        plannedHeadcount: department.headcount - 3,
      },
    });
    positions.set(`${department.code}-HEAD`, head.id);
    positions.set(`${department.code}-SUP`, supervisor.id);
    positions.set(`${department.code}-STAFF`, staff.id);
  }

  // --- Reference data -----------------------------------------------------
  const documentTypes = new Map<string, { id: string; alertDaysBefore: number }>();
  for (const type of DOCUMENT_TYPES) {
    const row = await prisma.documentType.create({ data: { tenantId, ...type } });
    documentTypes.set(type.code, { id: row.id, alertDaysBefore: row.alertDaysBefore });
  }

  const contractTypes = new Map<string, string>();
  const contractTemplates = new Map<string, string>();
  for (const type of CONTRACT_TYPES) {
    const row = await prisma.contractType.create({ data: { tenantId, ...type } });
    contractTypes.set(type.code, row.id);

    const template = await prisma.contractTemplate.create({
      data: {
        tenantId,
        contractTypeId: row.id,
        language: 'fr',
        version: 1,
        title: templateTitle(type.code),
        body: templateBody(type.code),
      },
    });
    contractTemplates.set(type.code, template.id);

    await prisma.contractClause.createMany({
      data: CLAUSES.map((clause, index) => ({
        tenantId,
        templateId: template.id,
        key: clause.key,
        title: clause.title,
        text: clause.text,
        mandatory: clause.mandatory,
        sortOrder: index,
      })),
    });
  }

  const checklist = await prisma.checklistTemplate.create({
    data: { tenantId, code: 'NEW-HIRE', name: 'New hire' },
  });
  const checklistItems = [];
  for (const [index, item] of CHECKLIST.entries()) {
    checklistItems.push(
      await prisma.checklistItemTemplate.create({
        data: {
          tenantId,
          templateId: checklist.id,
          title: item.title,
          ownerRole: item.owner,
          dueOffsetDays: item.offset,
          requiresDocumentTypeId: item.document ? documentTypes.get(item.document)!.id : null,
          departmentCodes: [...item.departments],
          sortOrder: index,
        },
      }),
    );
  }

  // Leave set-up, and with it the public holidays: a calendar is time and
  // absence's (M08), and every screen that counts days reads it from there.
  const leave = await seedHr02Leave(prisma, tenantId, sites);

  // --- People -------------------------------------------------------------
  const people = plan(random);
  const created = new Map<string, string>();

  // In order, so a manager always exists before the people who report to them.
  for (const person of people) {
    const row = await prisma.employee.create({
      data: {
        tenantId,
        companyId,
        employeeNumber: person.number,
        status: person.status,
        firstName: person.first,
        lastName: person.last,
        gender: person.gender,
        birthDate: day(person.birthDate),
        nationality: 'MA',
        nationalId: person.nationalId,
        maritalStatus: person.maritalStatus,
        address: person.address,
        phone: person.phone,
        email: person.email,
        positionId: positions.get(person.position)!,
        departmentId: departments.get(person.department)!,
        siteId: sites.get(departmentOf(person.department).site)!,
        costCentreId: costCentres.get(departmentOf(person.department).costCentre)!,
        managerId: person.manager ? created.get(person.manager) : null,
        hireDate: day(person.hireDate),
        seniorityDate: day(person.hireDate),
        baseSalaryMinor: person.salaryMinor,
        salaryCurrency: 'MAD',
        socialSecurityNumber: person.socialSecurityNumber,
        pensionMember: person.pensionMember,
        bankName: person.bankName,
        bankAccount: person.bankAccount,
      },
    });
    created.set(person.key, row.id);
  }

  // The head of each department, now that the people exist.
  for (const department of DEPARTMENTS) {
    const head = people.find((person) => person.department === department.code && person.level === 1);
    if (head) {
      await prisma.department.update({
        where: { id: departments.get(department.code)! },
        data: { headEmployeeId: created.get(head.key)! },
      });
    }
  }

  // --- Contracts ----------------------------------------------------------
  let contracts = 0;
  for (const person of people) {
    const typeId = contractTypes.get(person.contractType)!;
    const signed = person.status !== 'onboarding';

    await prisma.contract.create({
      data: {
        tenantId,
        employeeId: created.get(person.key)!,
        contractTypeId: typeId,
        templateId: contractTemplates.get(person.contractType)!,
        status: signed ? 'signed' : 'draft',
        startDate: day(person.hireDate),
        endDate: person.contractEnd ? day(person.contractEnd) : null,
        trialEndDate: day(addDays(person.hireDate, person.contractType === 'CDI' ? 90 : 45)),
        positionId: positions.get(person.position)!,
        workplaceSiteId: sites.get(departmentOf(person.department).site)!,
        salaryMinor: person.salaryMinor,
        salaryCurrency: 'MAD',
        generatedAt: signed ? new Date(`${person.hireDate}T09:00:00Z`) : null,
        signedAt: signed ? new Date(`${person.hireDate}T15:00:00Z`) : null,
      },
    });
    contracts += 1;
  }

  // --- Documents ----------------------------------------------------------
  // Most people are in order; a handful are not, which is what the home screen's
  // "documents expiring" count and the orange dots in the list are about.
  const documents: {
    tenantId: string;
    employeeId: string;
    documentTypeId: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
    issueDate: Date;
    expiryDate: Date | null;
  }[] = [];

  for (const person of people) {
    const employeeId = created.get(person.key)!;
    const identity = documentTypes.get('CIN')!;

    documents.push({
      tenantId,
      employeeId,
      documentTypeId: identity.id,
      fileName: `cin-${person.number.toLowerCase()}.pdf`,
      mimeType: 'application/pdf',
      byteSize: 180_000 + Math.floor(random() * 90_000),
      issueDate: day(addDays(person.hireDate, -30)),
      expiryDate: day(addDays(DEMO_TODAY, 400 + Math.floor(random() * 900))),
    });

    if (person.expiring) {
      const type = documentTypes.get(person.expiring.type)!;
      documents.push({
        tenantId,
        employeeId,
        documentTypeId: type.id,
        fileName: `${person.expiring.type.toLowerCase()}-${person.number.toLowerCase()}.pdf`,
        mimeType: 'application/pdf',
        byteSize: 120_000 + Math.floor(random() * 60_000),
        issueDate: day(addDays(DEMO_TODAY, -300)),
        expiryDate: day(addDays(DEMO_TODAY, person.expiring.inDays)),
      });
    }
  }

  await prisma.employeeDocument.createMany({ data: documents });

  // --- Onboarding ---------------------------------------------------------
  let tasks = 0;
  for (const person of people.filter((candidate) => candidate.status === 'onboarding')) {
    const applicable = checklistItems.filter((item) => {
      const codes = item.departmentCodes;
      return codes.length === 0 || codes.includes(person.department);
    });

    for (const [index, item] of applicable.entries()) {
      // Half the list is done, which is what an onboarding in progress looks like.
      const done = index < Math.floor(applicable.length / 2);
      await prisma.onboardingTask.create({
        data: {
          tenantId,
          employeeId: created.get(person.key)!,
          templateId: checklist.id,
          itemTemplateId: item.id,
          title: item.title,
          ownerRole: item.ownerRole,
          dueDate: day(addDays(person.hireDate, item.dueOffsetDays)),
          status: done ? 'done' : 'todo',
          doneAt: done ? new Date(`${DEMO_TODAY}T08:30:00Z`) : null,
          doneBy: done ? 'Salma Benali' : null,
          sortOrder: item.sortOrder,
        },
      });
      tasks += 1;
    }
  }

  return { employees: people.length, contracts, documents: documents.length, tasks, leave };
}

/** Everything this tenant's demo owns, in an order the foreign keys allow. */
async function clear(prisma: CPeoplePrismaClient, tenantId: string): Promise<void> {
  const where = { tenantId };

  await prisma.department.updateMany({ where, data: { headEmployeeId: null } });
  await prisma.onboardingTask.deleteMany({ where });
  await prisma.employeeDocument.deleteMany({ where });
  await prisma.contract.deleteMany({ where });
  await prisma.dependent.deleteMany({ where });
  await prisma.employee.deleteMany({ where });
  await prisma.checklistItemTemplate.deleteMany({ where });
  await prisma.checklistTemplate.deleteMany({ where });
  await prisma.contractClause.deleteMany({ where });
  await prisma.contractTemplate.deleteMany({ where });
  await prisma.contractType.deleteMany({ where });
  await prisma.documentType.deleteMany({ where });
  await prisma.position.deleteMany({ where });
  await prisma.department.deleteMany({ where });
  await prisma.costCentre.deleteMany({ where });
  await prisma.site.deleteMany({ where });
  await clearHr02Leave(prisma, tenantId);
  await prisma.auditEvent.deleteMany({ where });
}

interface PlannedPerson {
  /** Stable while the plan is built; the employee number is decided at the end. */
  key: string;
  number: string;
  first: string;
  last: string;
  gender: 'female' | 'male' | 'unspecified';
  birthDate: string;
  nationalId: string;
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  address: string;
  phone: string;
  email: string;
  department: (typeof DEPARTMENTS)[number]['code'];
  position: string;
  /** 0 general manager, 1 head of department, 2 supervisor, 3 team member. */
  level: number;
  /** The key of this person's manager, not their number. */
  manager: string | null;
  hireDate: string;
  status: 'onboarding' | 'active' | 'left';
  contractType: 'CDI' | 'CDD' | 'ANAPEC';
  contractEnd: string | null;
  salaryMinor: number;
  socialSecurityNumber: string;
  pensionMember: boolean;
  bankName: string;
  bankAccount: string;
  expiring?: { type: 'RESIDENCE' | 'MEDICAL'; inDays: number };
}

/**
 * Who exists, in one pass, so every later step reads from the same list.
 *
 * The shape comes from the home screen the client has already seen: 148 people
 * across five departments, twelve of them on a fixed term, three on an insertion
 * contract, and a handful of documents about to expire.
 */
function plan(random: () => number): PlannedPerson[] {
  const people: PlannedPerson[] = [];
  // The named characters are spoken for before anyone is invented, so the
  // generator cannot hand their names to somebody else and leave the demo with
  // two Omar Chraibis.
  const used = new Set<string>(CAST.map((member) => `${member.first} ${member.last}`));
  let keys = 0;

  const person = (options: {
    department: (typeof DEPARTMENTS)[number]['code'];
    level: number;
    manager: string | null;
  }): PlannedPerson => {
    const gender = random() < 0.5 ? 'female' : 'male';
    let first = pick(GIVEN_NAMES[gender], random);
    let last = pick(FAMILY_NAMES, random);
    // Two people may share a name; two people may not share an identifier.
    while (used.has(`${first} ${last}`)) {
      first = pick(GIVEN_NAMES[gender], random);
      last = pick(FAMILY_NAMES, random);
    }
    used.add(`${first} ${last}`);

    const seniorityYears =
      options.level === 0 ? 12 : options.level === 1 ? 8 : options.level === 2 ? 5 : 1;
    const hireDate = addDays(DEMO_TODAY, -(seniorityYears * 365 + Math.floor(random() * 300)));

    return {
      key: `p${keys++}`,
      number: '',
      first,
      last,
      gender,
      birthDate: addDays(DEMO_TODAY, -(Math.floor(random() * 10_000) + 8_000)),
      nationalId: identifier('A', random),
      maritalStatus: random() < 0.55 ? 'married' : 'single',
      address: `${1 + Math.floor(random() * 120)} rue des Demos, Rabat`,
      phone: `+2126${String(10_000_000 + Math.floor(random() * 89_999_999))}`,
      email: '',
      department: options.department,
      position:
        options.level === 0
          ? 'POS-GM'
          : `${options.department}-${options.level === 1 ? 'HEAD' : options.level === 2 ? 'SUP' : 'STAFF'}`,
      level: options.level,
      manager: options.manager,
      hireDate,
      status: 'active',
      contractType: 'CDI',
      contractEnd: null,
      salaryMinor: salaryFor(options.level, random),
      socialSecurityNumber: identifier('', random, 9),
      pensionMember: options.level <= 2,
      bankName: 'Banque Démo',
      bankAccount: String(Math.floor(random() * 9e9)).padStart(24, '0'),
    };
  };

  // The top of the tree, then each department: a head, two supervisors, and the
  // rest of the team reporting to them.
  const general = person({ department: 'ADM', level: 0, manager: null });
  people.push(general);

  for (const department of DEPARTMENTS) {
    const head = person({ department: department.code, level: 1, manager: general.key });
    people.push(head);

    const supervisors = [0, 1].map(() =>
      person({ department: department.code, level: 2, manager: head.key }),
    );
    people.push(...supervisors);

    // The head, two supervisors, and the rest of the team — less the general
    // manager, who is one of Administration's twenty rather than an extra.
    const team = department.headcount - 3 - (department.code === 'ADM' ? 1 : 0);
    for (let index = 0; index < team; index += 1) {
      people.push(
        person({
          department: department.code,
          level: 3,
          manager: supervisors[index % supervisors.length]!.key,
        }),
      );
    }
  }

  // The named characters take the places their story needs: a head of department
  // where the script calls them one, the HR manager among the supervisors in
  // Administration, everyone else on their department's team.
  const cast = new Set<string>();
  for (const member of CAST) {
    const level = member.role.startsWith('Head') ? 1 : member.role === 'HR manager' ? 2 : 3;
    const slot = people.find(
      (candidate) =>
        candidate.department === member.department &&
        candidate.level === level &&
        !cast.has(candidate.key),
    );
    if (!slot) continue;

    cast.add(slot.key);
    slot.number = member.number;
    slot.first = member.first;
    slot.last = member.last;
    slot.gender = member.gender;
    slot.email = member.email ?? '';
  }

  // Numbers last, so a named character keeps the number the demo script uses and
  // nobody else can take it.
  const reserved = new Set(people.map((candidate) => candidate.number).filter(Boolean));
  let next = 1;
  for (const candidate of people) {
    if (candidate.number === '') {
      let number = `SMG-${String(next++).padStart(4, '0')}`;
      while (reserved.has(number)) number = `SMG-${String(next++).padStart(4, '0')}`;
      reserved.add(number);
      candidate.number = number;
    }

    if (candidate.email === '') {
      const suffix = candidate.number.slice(4).replace(/^0+/, '');
      candidate.email = `${slug(candidate.first)}.${slug(candidate.last)}.${suffix}@smg-demo.test`;
    }
  }

  // Twelve fixed terms in all — three of them insertion contracts — taken from
  // the team members so the managers stay permanent. Omar Chraibi is the
  // twelfth, and his ends during the demo week, which is what the home screen's
  // "12 on fixed-term contracts" counts.
  const fixedTerm = people
    .filter((candidate) => candidate.level === 3 && !cast.has(candidate.key))
    .slice(0, 11);
  for (const [index, candidate] of fixedTerm.entries()) {
    candidate.contractType = index < 3 ? 'ANAPEC' : 'CDD';
    candidate.hireDate = addDays(DEMO_TODAY, -(200 + index * 11));
    candidate.contractEnd = addDays(candidate.hireDate, 365);
  }

  const omar = people.find((candidate) => candidate.number === 'SMG-0009');
  if (omar) {
    omar.contractType = 'CDD';
    omar.hireDate = addDays(DEMO_TODAY, -358);
    omar.contractEnd = '2026-11-30';
  }

  // Two people start next month, half way through their checklist.
  const permanentTeam = people.filter(
    (candidate) =>
      candidate.level === 3 && !cast.has(candidate.key) && candidate.contractEnd === null,
  );
  for (const candidate of permanentTeam.slice(-2)) {
    candidate.status = 'onboarding';
    candidate.hireDate = '2026-12-01';
  }

  // Five documents expiring inside thirty days, as the home screen says: two
  // residence permits and three medical certificates, plus two already expired.
  const expiring: { type: 'RESIDENCE' | 'MEDICAL'; inDays: number }[] = [
    { type: 'RESIDENCE', inDays: 9 },
    { type: 'RESIDENCE', inDays: 21 },
    { type: 'MEDICAL', inDays: 4 },
    { type: 'MEDICAL', inDays: 17 },
    { type: 'MEDICAL', inDays: 28 },
    { type: 'MEDICAL', inDays: -6 },
    { type: 'RESIDENCE', inDays: -40 },
  ];
  // One per department where possible, so the five are spread across the company
  // and a manager's count differs from HR's — which is the point of the scope.
  const perDepartment = DEPARTMENTS.map((department) =>
    people.filter(
      (candidate) =>
        candidate.department === department.code &&
        candidate.level === 3 &&
        candidate.status === 'active',
    ),
  );
  for (const [index, item] of expiring.entries()) {
    const column = perDepartment[index % perDepartment.length]!;
    const candidate = column[Math.floor(index / perDepartment.length) + 4];
    if (candidate) candidate.expiring = item;
  }

  return people;
}

function departmentOf(code: string): (typeof DEPARTMENTS)[number] {
  return DEPARTMENTS.find((department) => department.code === code)!;
}

function salaryFor(level: number, random: () => number): number {
  const base = level === 0 ? 38_000 : level === 1 ? 22_000 : level === 2 ? 12_000 : 5_200;
  const spread = level === 3 ? 2_400 : 6_000;
  // Rounded to 100 MAD, then in minor units.
  return Math.round((base + random() * spread) / 100) * 100 * 100;
}

function identifier(prefix: string, random: () => number, digits = 6): string {
  return prefix + String(Math.floor(random() * 10 ** digits)).padStart(digits, '0');
}

function pick<T>(from: readonly T[], random: () => number): T {
  return from[Math.floor(random() * from.length)]!;
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '-');
}

/** A plain date at UTC midnight: a day, not an instant. */
function day(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A small deterministic generator: same seed, same demo, every time. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const CLAUSES = [
  {
    key: 'parties',
    title: 'Entre les soussignés',
    mandatory: true,
    text: 'Entre {{company.name}}, dont le siège est à {{company.city}}, ci-après « l’employeur », et {{employee.fullName}}, titulaire de la pièce d’identité n° {{employee.cin}}, demeurant {{employee.address}}, ci-après « le salarié ». [Clause type – à valider par SMG]',
  },
  {
    key: 'engagement',
    title: 'Article 1 – Engagement',
    mandatory: true,
    text: 'Le salarié est engagé en qualité de {{position.title}} au sein du service {{department.name}}, à compter du {{contract.startDate}}. [Clause type – à valider par SMG]',
  },
  {
    key: 'trial',
    title: "Article 2 – Période d'essai",
    mandatory: true,
    text: 'Le présent contrat est conclu sous réserve d’une période d’essai prenant fin le {{contract.trialEndDate}}. [Clause type – à valider par SMG]',
  },
  {
    key: 'duties',
    title: 'Article 3 – Fonctions',
    mandatory: true,
    text: 'Le salarié exerce ses fonctions sous l’autorité de sa hiérarchie, au lieu de travail {{site.name}}. [Clause type – à valider par SMG]',
  },
  {
    key: 'salary',
    title: 'Article 4 – Rémunération',
    mandatory: true,
    text: 'Le salarié perçoit une rémunération mensuelle brute de {{contract.salaryMonthly}}, payable à terme échu. [Clause type – à valider par SMG]',
  },
  {
    key: 'hours',
    title: 'Article 5 – Durée du travail',
    mandatory: true,
    text: 'La durée du travail est celle prévue par la législation en vigueur. [Clause type – à valider par SMG]',
  },
  {
    key: 'confidentiality',
    title: 'Article 6 – Confidentialité',
    mandatory: false,
    text: 'Le salarié s’engage à observer la plus stricte confidentialité sur les informations dont il a connaissance. [Clause type – à valider par SMG]',
  },
  {
    key: 'non-compete',
    title: 'Article 7 – Non-concurrence',
    mandatory: false,
    text: 'Clause de non-concurrence, dont la portée et la durée restent à définir. [Clause type – à valider par SMG]',
  },
] as const;

function templateTitle(code: string): string {
  if (code === 'CDI') return 'CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE';
  if (code === 'CDD') return 'CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE';
  return "CONTRAT D'INSERTION ANAPEC";
}

function templateBody(code: string): string {
  const term =
    code === 'CDI'
      ? 'Le présent contrat est conclu pour une durée indéterminée.'
      : 'Le présent contrat est conclu pour une durée déterminée, du {{contract.startDate}} au {{contract.endDate}}.';

  return [
    '{{company.name}} — {{company.city}}',
    '',
    templateTitle(code),
    '',
    term,
    '',
    'Les articles ci-après font partie intégrante du contrat.',
    '',
    'Fait à {{company.city}}, le {{today}}.',
    '',
    "MODÈLE – DÉMONSTRATION. Texte d'exemple, à valider par SMG.",
  ].join('\n');
}
