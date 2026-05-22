import 'dotenv/config'
import prisma from '../src/utils/prisma.js'  // ← usa la misma instancia que el backend

const medios = [
  { name: 'TV abierta', defaultCPR: 29000, defaultAM: 97, defaultV: 190 },
  { name: 'TV Local', defaultCPR: 22000, defaultAM: 40, defaultV: 300 },
  { name: 'TV Paga', defaultCPR: 23000, defaultAM: 45, defaultV: 300 },
  { name: 'Internet', defaultCPR: 24359, defaultAM: 90, defaultV: 280 },
  { name: 'OOH', defaultCPR: 33233, defaultAM: 36, defaultV: 300 },
  { name: 'Cine', defaultCPR: 251000, defaultAM: 5, defaultV: 350 },
  { name: 'Radio', defaultCPR: 119000, defaultAM: 28, defaultV: 250 },
  { name: 'Prensa', defaultCPR: 78321, defaultAM: 18, defaultV: 250 },
  { name: 'Revistas', defaultCPR: 115937, defaultAM: 20, defaultV: 250 },
  { name: 'Redes', defaultCPR: 25000, defaultAM: 70, defaultV: 150 },
  { name: 'CTV', defaultCPR: 13043, defaultAM: 30, defaultV: 200 },
  { name: 'Programatic', defaultCPR: 20000, defaultAM: 55, defaultV: 200 },
]

async function main() {
  for (const m of medios) {
    await prisma.mediumCatalog.upsert({
      where: { name: m.name },
      update: {},
      create: m,
    })
  }
  console.log('✅ Catálogo creado correctamente')
}

main()
  .catch(e => console.error(e))
  .finally(async () => { await prisma.$disconnect() })