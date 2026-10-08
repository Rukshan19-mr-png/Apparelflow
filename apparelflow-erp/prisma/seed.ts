import 'dotenv/config';
import { PrismaClient } from '../src/lib/generated/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
const adapter = databaseUrl.startsWith('file:')
  ? new PrismaLibSql({ url: databaseUrl })
  : new PrismaPg({ connectionString: databaseUrl });

const prisma = new PrismaClient({ adapter });

async function main() {
  const recipes = [
    { id: 'blouse', recipeCode: 'REC-BL01', name: 'Casual Blouse', category: 'Blouse', stdFabricYards: 1.8, wastageCap: 5, components: [['front','Front Body Panel',1],['back','Back Body Panel',1],['sleeves','Sleeves (Left & Right)',2],['collar','Collar & Stand',1],['cuffs','Sleeve Cuffs',2]] as [string, string, number][] },
    { id: 'crop', recipeCode: 'REC-CT02', name: 'Crop Top', category: 'Crop Top', stdFabricYards: 1.1, wastageCap: 8, components: [['chest','Front Chest Panel',1],['support','Back Support Panel',1],['binding','Neck Binding Strip',1],['elastic','Hem Elastic Casing',1],['straps','Side Strap Accents',2]] as [string, string, number][] },
  ];
  for (const recipe of recipes) {
    const { components, ...data } = recipe;
    const saved = await prisma.recipe.upsert({ where: { recipeCode: recipe.recipeCode }, update: { name: data.name, category: data.category, stdFabricYards: data.stdFabricYards, wastageCap: data.wastageCap }, create: data });
    for (const [id, componentName, piecesPerGarment] of components) {
      await prisma.recipeComponent.upsert({ where: { recipeId_componentName: { recipeId: saved.id, componentName } }, update: { piecesPerGarment }, create: { id, recipeId: saved.id, componentName, piecesPerGarment } });
    }
  }
  for (const [id, email, fullName, role] of [
    ['demo-cutting-supervisor','alex@demo.apparelflow.test','Alex Morgan','cutting_supervisor'],
    ['demo-cutting-verifier','maya@demo.apparelflow.test','Maya Chen','cutting_verifier'],
    ['demo-sewing-supervisor','jordan@demo.apparelflow.test','Jordan Lee','sewing_supervisor'],
  ]) {
    await prisma.user.upsert({ where: { email }, update: { fullName, role }, create: { id, email, fullName, role, passwordHash: 'demo-session-only' } });
  }
}

main().then(async () => { await prisma.$disconnect(); }).catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
