import { PrismaClient, PlantSpeciesSource, VaultRole } from '@prisma/client';
import { normalizePlantLookupKey } from '../lib/plants';

const prisma = new PrismaClient();
const DEFAULT_SOIL_TYPE = 'well-draining indoor potting mix';

function getDefaultCareNotes(lightRequirement: string) {
  return `Keep this plant in ${lightRequirement} conditions, avoid standing water, and adjust watering slightly during cooler or darker months.`;
}

const starterSpecies = [
  {
    scientificName: 'Monstera deliciosa',
    aliases: ['Swiss cheese plant'],
    wateringIntervalDays: 7,
    fertilizerIntervalDays: 30,
    lightRequirement: 'bright indirect',
  },
  {
    scientificName: 'Monstera adansonii',
    aliases: ['Swiss cheese vine'],
    wateringIntervalDays: 6,
    fertilizerIntervalDays: 30,
    lightRequirement: 'bright indirect',
  },
  {
    scientificName: 'Epipremnum aureum',
    aliases: ['Pothos', 'Golden pothos', "Devil's ivy"],
    wateringIntervalDays: 8,
    fertilizerIntervalDays: 45,
    lightRequirement: 'medium to bright indirect',
  },
  {
    scientificName: 'Scindapsus pictus',
    aliases: ['Satin pothos', 'Silver pothos'],
    wateringIntervalDays: 8,
    fertilizerIntervalDays: 45,
    lightRequirement: 'medium to bright indirect',
  },
  {
    scientificName: 'Spathiphyllum wallisii',
    aliases: ['Peace lily'],
    wateringIntervalDays: 5,
    fertilizerIntervalDays: 30,
    lightRequirement: 'medium indirect',
  },

  {
    scientificName: 'Ficus elastica',
    aliases: ['Rubber plant'],
    wateringIntervalDays: 9,
    fertilizerIntervalDays: 30,
    lightRequirement: 'bright indirect',
  },
  {
    scientificName: 'Ficus benjamina',
    aliases: ['Weeping fig'],
    wateringIntervalDays: 7,
    fertilizerIntervalDays: 30,
    lightRequirement: 'bright indirect',
  },
  {
    scientificName: 'Ficus lyrata',
    aliases: ['Fiddle leaf fig'],
    wateringIntervalDays: 7,
    fertilizerIntervalDays: 30,
    lightRequirement: 'bright indirect',
  },

  {
    scientificName: 'Dracaena marginata',
    aliases: ['Dragon tree'],
    wateringIntervalDays: 12,
    fertilizerIntervalDays: 45,
    lightRequirement: 'bright indirect',
  },
  {
    scientificName: 'Dracaena fragrans',
    aliases: ['Corn plant'],
    wateringIntervalDays: 10,
    fertilizerIntervalDays: 45,
    lightRequirement: 'medium indirect',
  },
  {
    scientificName: 'Dracaena reflexa',
    aliases: ['Song of India'],
    wateringIntervalDays: 10,
    fertilizerIntervalDays: 45,
    lightRequirement: 'bright indirect',
  },

  {
    scientificName: 'Sansevieria trifasciata',
    aliases: ['Snake plant', "Mother in law's tongue"],
    wateringIntervalDays: 14,
    fertilizerIntervalDays: 60,
    lightRequirement: 'low to bright indirect',
  },
  {
    scientificName: 'Sansevieria cylindrica',
    aliases: ['Cylindrical snake plant'],
    wateringIntervalDays: 14,
    fertilizerIntervalDays: 60,
    lightRequirement: 'bright indirect',
  },

  {
    scientificName: 'Zamioculcas zamiifolia',
    aliases: ['ZZ plant'],
    wateringIntervalDays: 14,
    fertilizerIntervalDays: 60,
    lightRequirement: 'low to medium indirect',
  },

  {
    scientificName: 'Chlorophytum comosum',
    aliases: ['Spider plant'],
    wateringIntervalDays: 7,
    fertilizerIntervalDays: 30,
    lightRequirement: 'bright indirect',
  },

  {
    scientificName: 'Calathea orbifolia',
    aliases: ['Prayer plant'],
    wateringIntervalDays: 5,
    fertilizerIntervalDays: 30,
    lightRequirement: 'medium indirect',
  },
  {
    scientificName: 'Calathea lancifolia',
    aliases: ['Rattlesnake plant'],
    wateringIntervalDays: 5,
    fertilizerIntervalDays: 30,
    lightRequirement: 'medium indirect',
  },

  {
    scientificName: 'Maranta leuconeura',
    aliases: ['Prayer plant'],
    wateringIntervalDays: 5,
    fertilizerIntervalDays: 30,
    lightRequirement: 'medium indirect',
  },

  {
    scientificName: 'Philodendron hederaceum',
    aliases: ['Heartleaf philodendron'],
    wateringIntervalDays: 7,
    fertilizerIntervalDays: 30,
    lightRequirement: 'medium indirect',
  },
  {
    scientificName: 'Philodendron birkin',
    aliases: ['Birkin philodendron'],
    wateringIntervalDays: 7,
    fertilizerIntervalDays: 30,
    lightRequirement: 'bright indirect',
  },
  {
    scientificName: 'Philodendron gloriosum',
    aliases: ['Velvet philodendron'],
    wateringIntervalDays: 7,
    fertilizerIntervalDays: 30,
    lightRequirement: 'bright indirect',
  },

  {
    scientificName: 'Anthurium andraeanum',
    aliases: ['Flamingo flower'],
    wateringIntervalDays: 6,
    fertilizerIntervalDays: 30,
    lightRequirement: 'bright indirect',
  },

  {
    scientificName: 'Alocasia amazonica',
    aliases: ['African mask plant'],
    wateringIntervalDays: 5,
    fertilizerIntervalDays: 30,
    lightRequirement: 'bright indirect',
  },
  {
    scientificName: 'Alocasia zebrina',
    aliases: ['Zebra alocasia'],
    wateringIntervalDays: 5,
    fertilizerIntervalDays: 30,
    lightRequirement: 'bright indirect',
  },

  {
    scientificName: 'Dieffenbachia seguine',
    aliases: ['Dumb cane'],
    wateringIntervalDays: 7,
    fertilizerIntervalDays: 30,
    lightRequirement: 'medium indirect',
  },

  {
    scientificName: 'Aglaonema commutatum',
    aliases: ['Chinese evergreen'],
    wateringIntervalDays: 9,
    fertilizerIntervalDays: 45,
    lightRequirement: 'low to medium indirect',
  },

  {
    scientificName: 'Schefflera arboricola',
    aliases: ['Dwarf umbrella tree'],
    wateringIntervalDays: 7,
    fertilizerIntervalDays: 30,
    lightRequirement: 'bright indirect',
  },

  {
    scientificName: 'Peperomia obtusifolia',
    aliases: ['Baby rubber plant'],
    wateringIntervalDays: 9,
    fertilizerIntervalDays: 45,
    lightRequirement: 'bright indirect',
  },
  {
    scientificName: 'Peperomia caperata',
    aliases: ['Emerald ripple peperomia'],
    wateringIntervalDays: 8,
    fertilizerIntervalDays: 45,
    lightRequirement: 'medium indirect',
  },

  {
    scientificName: 'Pilea peperomioides',
    aliases: ['Chinese money plant'],
    wateringIntervalDays: 7,
    fertilizerIntervalDays: 30,
    lightRequirement: 'bright indirect',
  },

  {
    scientificName: 'Tradescantia zebrina',
    aliases: ['Wandering dude'],
    wateringIntervalDays: 6,
    fertilizerIntervalDays: 30,
    lightRequirement: 'bright indirect',
  },

  {
    scientificName: 'Begonia maculata',
    aliases: ['Polka dot begonia'],
    wateringIntervalDays: 6,
    fertilizerIntervalDays: 30,
    lightRequirement: 'bright indirect',
  },

  {
    scientificName: 'Hoya carnosa',
    aliases: ['Wax plant'],
    wateringIntervalDays: 10,
    fertilizerIntervalDays: 45,
    lightRequirement: 'bright indirect',
  },
  {
    scientificName: 'Hoya kerrii',
    aliases: ['Sweetheart plant'],
    wateringIntervalDays: 12,
    fertilizerIntervalDays: 45,
    lightRequirement: 'bright indirect',
  },

  {
    scientificName: 'Aloe vera',
    aliases: ['Aloe'],
    wateringIntervalDays: 14,
    fertilizerIntervalDays: 60,
    lightRequirement: 'bright direct',
  },

  {
    scientificName: 'Crassula ovata',
    aliases: ['Jade plant'],
    wateringIntervalDays: 14,
    fertilizerIntervalDays: 60,
    lightRequirement: 'bright light',
  },

  {
    scientificName: 'Echeveria elegans',
    aliases: ['Mexican snowball'],
    wateringIntervalDays: 12,
    fertilizerIntervalDays: 60,
    lightRequirement: 'bright light',
  },

  {
    scientificName: 'Kalanchoe blossfeldiana',
    aliases: ['Flaming Katy'],
    wateringIntervalDays: 10,
    fertilizerIntervalDays: 45,
    lightRequirement: 'bright light',
  },

  {
    scientificName: 'Mammillaria elongata',
    aliases: ['Ladyfinger cactus'],
    wateringIntervalDays: 18,
    fertilizerIntervalDays: 60,
    lightRequirement: 'bright direct',
  },

  {
    scientificName: 'Cereus peruvianus',
    aliases: ['Column cactus'],
    wateringIntervalDays: 18,
    fertilizerIntervalDays: 60,
    lightRequirement: 'bright direct',
  },

  {
    scientificName: 'Chamaedorea elegans',
    aliases: ['Parlor palm'],
    wateringIntervalDays: 7,
    fertilizerIntervalDays: 45,
    lightRequirement: 'medium indirect',
  },

  {
    scientificName: 'Dypsis lutescens',
    aliases: ['Areca palm'],
    wateringIntervalDays: 6,
    fertilizerIntervalDays: 30,
    lightRequirement: 'bright indirect',
  },

  {
    scientificName: 'Howea forsteriana',
    aliases: ['Kentia palm'],
    wateringIntervalDays: 7,
    fertilizerIntervalDays: 45,
    lightRequirement: 'medium indirect',
  },

  {
    scientificName: 'Rhapis excelsa',
    aliases: ['Lady palm'],
    wateringIntervalDays: 7,
    fertilizerIntervalDays: 45,
    lightRequirement: 'medium indirect',
  },
];

async function seedSpecies() {
  const speciesByName = new Map<string, string>();

  for (const species of starterSpecies) {
    const normalizedLookupKey = normalizePlantLookupKey(species.scientificName);
    const record = await prisma.plantSpecies.upsert({
      where: {
        normalizedLookupKey,
      },
      update: {
        scientificName: species.scientificName,
        wateringIntervalDays: species.wateringIntervalDays,
        fertilizerIntervalDays: species.fertilizerIntervalDays,
        lightRequirement: species.lightRequirement,
        soilType: DEFAULT_SOIL_TYPE,
        petToxic: null,
        careNotes: getDefaultCareNotes(species.lightRequirement),
        source: PlantSpeciesSource.seed,
      },
      create: {
        scientificName: species.scientificName,
        normalizedLookupKey,
        wateringIntervalDays: species.wateringIntervalDays,
        fertilizerIntervalDays: species.fertilizerIntervalDays,
        lightRequirement: species.lightRequirement,
        soilType: DEFAULT_SOIL_TYPE,
        petToxic: null,
        careNotes: getDefaultCareNotes(species.lightRequirement),
        source: PlantSpeciesSource.seed,
      },
    });

    speciesByName.set(species.scientificName, record.id);

    await prisma.plantSpeciesAlias.createMany({
      data: species.aliases.map((aliasName) => ({
        speciesId: record.id,
        aliasName,
        normalizedAliasKey: normalizePlantLookupKey(aliasName),
      })),
      skipDuplicates: true,
    });
  }

  return speciesByName;
}

async function main() {
  const speciesByName = await seedSpecies();

  const demoUserEmail = 'demo@plantkeeper.local';
  const demoUser = await prisma.user.upsert({
    where: {
      email: demoUserEmail,
    },
    update: {
      name: 'Demo Gardener',
    },
    create: {
      email: demoUserEmail,
      name: 'Demo Gardener',
    },
  });

  const demoVault = await prisma.vault.upsert({
    where: {
      id: '11111111-1111-1111-1111-111111111111',
    },
    update: {
      name: 'Home Plants',
    },
    create: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Home Plants',
    },
  });

  await prisma.vaultMember.upsert({
    where: {
      vaultId_userId: {
        vaultId: demoVault.id,
        userId: demoUser.id,
      },
    },
    update: {
      role: VaultRole.owner,
    },
    create: {
      vaultId: demoVault.id,
      userId: demoUser.id,
      role: VaultRole.owner,
    },
  });

  const monsteraId = speciesByName.get('Monstera deliciosa');

  if (!monsteraId) {
    throw new Error('Starter species Monstera deliciosa was not seeded');
  }

  await prisma.plant.upsert({
    where: {
      id: '22222222-2222-2222-2222-222222222222',
    },
    update: {
      vaultId: demoVault.id,
      speciesId: monsteraId,
      nickname: 'Living room Monstera',
      customWateringIntervalDays: null,
      nextWateringAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
    create: {
      id: '22222222-2222-2222-2222-222222222222',
      vaultId: demoVault.id,
      speciesId: monsteraId,
      nickname: 'Living room Monstera',
      customWateringIntervalDays: null,
      nextWateringAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
