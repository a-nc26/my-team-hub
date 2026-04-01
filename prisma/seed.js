const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const team = [
  { name: 'Celine', initials: 'CE', role: 'Analyst', color: 0 },
  { name: 'Emily', initials: 'EM', role: 'Analyst', color: 1 },
  { name: 'Jade', initials: 'JA', role: 'Analyst', color: 2 },
  { name: 'Shira', initials: 'SH', role: 'Analyst', color: 3 },
  { name: 'Tsuf', initials: 'TS', role: 'Analyst', color: 4 },
  { name: 'Valeri', initials: 'VA', role: 'Analyst', color: 5 },
  { name: 'New Analyst', initials: 'NA', role: 'Analyst', color: 6, pending: true },
]

async function main() {
  console.log('Seeding team members...')
  for (const member of team) {
    const existing = await prisma.analyst.findFirst({ where: { name: member.name } })
    if (!existing) {
      await prisma.analyst.create({ data: member })
      console.log(`  Created: ${member.name}`)
    } else {
      console.log(`  Skipped (exists): ${member.name}`)
    }
  }
  console.log('Done.')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
