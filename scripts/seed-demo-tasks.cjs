/* One-off demo tasks — run: dotenv -e .env.local -- node scripts/seed-demo-tasks.cjs */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function daysFromNow(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(15, 0, 0, 0);
  return d;
}

const rows = [
  {
    rawInput: "Сьогодні до 18:00 — відправити клієнту правки по макету, терміново",
    title: "Правки по макету клієнту",
    priority: "high",
    category: "work",
    estimatedHours: 2,
    deadline: daysFromNow(0),
    done: false,
  },
  {
    rawInput: "Завтра рано написати в бухгалтерію про рахунок",
    title: "Написати в бухгалтерію про рахунок",
    priority: "medium",
    category: "work",
    estimatedHours: 0.5,
    deadline: daysFromNow(1),
    done: false,
  },
  {
    rawInput: "До пʼятниці підготувати короткий звіт по проєкту на 1 сторінку",
    title: "Короткий звіт по проєкту",
    priority: "medium",
    category: "work",
    estimatedHours: 3,
    deadline: daysFromNow(4),
    done: false,
  },
  {
    rawInput: "Низький пріоритет: колись переглянути старі нотатки в Notion",
    title: "Переглянути старі нотатки в Notion",
    priority: "low",
    category: "personal",
    estimatedHours: 1.5,
    deadline: null,
    done: false,
  },
  {
    rawInput: "Вечіром 45 хв — урок іспанської Duolingo + підкаст",
    title: "Іспанська: Duolingo + підкаст",
    priority: "low",
    category: "learning",
    estimatedHours: 1,
    deadline: daysFromNow(0),
    done: false,
  },
  {
    rawInput: "До середи прочитати 2 розділи книги з TypeScript",
    title: "2 розділи книги з TypeScript",
    priority: "medium",
    category: "learning",
    estimatedHours: 4,
    deadline: daysFromNow(2),
    done: false,
  },
  {
    rawInput: "Записатися на ТО машини на наступний тиждень",
    title: "Запис на ТО машини",
    priority: "medium",
    category: "personal",
    estimatedHours: 0.25,
    deadline: daysFromNow(6),
    done: false,
  },
  {
    rawInput: "Терміново: продакшн впав, подивитися логи Vercel і Slack",
    title: "Розібратися з падінням продакшену",
    priority: "high",
    category: "work",
    estimatedHours: 2,
    deadline: daysFromNow(0),
    done: false,
  },
  {
    rawInput: "Купити подарунок на день народження (до суботи)",
    title: "Купити подарунок на день народження",
    priority: "high",
    category: "personal",
    estimatedHours: 2,
    deadline: daysFromNow(5),
    done: false,
  },
  {
    rawInput: "Після обіду — кол з командою по роадмапу на 1 год",
    title: "Кол з командою: роадмап",
    priority: "medium",
    category: "work",
    estimatedHours: 1,
    deadline: daysFromNow(1),
    done: false,
  },
  {
    rawInput: "Вже зроблено: оновити README в репозиторії",
    title: "Оновити README в репозиторії",
    priority: "low",
    category: "work",
    estimatedHours: 0.5,
    deadline: daysFromNow(-1),
    done: true,
  },
  {
    rawInput: "Наступного понеділка — планування спринту на 2 години",
    title: "Планування спринту",
    priority: "medium",
    category: "work",
    estimatedHours: 2,
    deadline: daysFromNow(7),
    done: false,
  },
];

async function main() {
  let n = 0;
  for (const data of rows) {
    await prisma.task.create({ data });
    n += 1;
  }
  console.log(`Створено задач: ${n}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
