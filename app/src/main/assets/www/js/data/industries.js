/* Отрасли: у каждой свои цены, издержки, сезонность, риски и возможности */
var MS = globalThis.MS = globalThis.MS || {};

MS.INDUSTRIES = {
  manufacturing: {
    id: 'manufacturing', name: 'Производство', short: 'Производство',
    company: 'Производство мебели и металлоконструкций',
    desc: 'Капиталоёмкий бизнес: оборудование определяет мощность и качество, запасы сырья и готовой продукции требуют денег.',
    features: ['Мощность ограничена оборудованием', 'Готовая продукция хранится на складе', 'Покупатели платят с отсрочкой 30%'],
    risks: ['Поломки изношенного оборудования', 'Срывы поставок сырья', 'Затоваривание склада'],
    opportunities: ['Модернизация линий', 'Экспорт и федеральные сети', 'Сертификация ISO 9001'],
    unit: 'изд.', unitGen: 'изделий', prodLabel: 'Производственный цех', prodWorker: 'рабочие',
    price: 13000, matCost: 4800, marketDemand: 6200, startShare: 0.08,
    staff: { prod: { n: 24, wage: 58000 }, sales: { n: 5, wage: 62000 }, admin: { n: 5, wage: 72000 } },
    laborPU: 20.5, startCapacity: 620, capUnitCost: 22000, deprMonths: 120,
    overhead: 360000, season: [0.85, 0.88, 0.98, 1.03, 1.05, 1.06, 1.02, 1.04, 1.08, 1.07, 1.0, 0.94],
    volatility: 0.10, elasticity: 1.7, qW: 1.0, rW: 0.8, mW: 0.9,
    inventory: 'stock', perishRate: 0, storageRate: 0.012,
    receivable: { share: 0.3, lag: 1 },
    socialRate: 0.30, skillDecay: 0.15, wageInflation: 0.07, baseTurnover: 0.012, startSkill: 50,
    breakdown: 1.0, capitalIntensity: 1.0,
    competitors: [
      { name: 'ЗаводСтрой', priceK: 0.97, q: 52, rep: 55, aw: 2.2 },
      { name: 'Металлика', priceK: 1.06, q: 62, rep: 60, aw: 1.8 },
      { name: 'ЭкоМебель', priceK: 0.92, q: 44, rep: 47, aw: 1.6 }
    ],
    branch: { name: 'Производственная площадка', cost: 30000000, months: 5, cap: 400, demand: 2500, overhead: 260000, staff: 16 },
    products: ['Модульная мебель', 'Металлические стеллажи', 'Офисная серия', 'Умная мебель', 'Экспортная линейка'],
    tags: ['capital', 'stock']
  },
  trade: {
    id: 'trade', name: 'Торговля', short: 'Торговля',
    company: 'Сеть магазинов бытовых товаров',
    desc: 'Низкая маржа и высокий оборот: решают цена, ассортимент, закупки и сезонные пики спроса.',
    features: ['Наценка около 45%', 'Сильный сезонный пик в декабре', 'Покупатели чувствительны к цене'],
    risks: ['Ценовые войны с сетями', 'Неликвидные остатки', 'Высокая аренда'],
    opportunities: ['Новые магазины', 'Интернет-канал продаж', 'Собственная торговая марка'],
    unit: 'чек', unitGen: 'чеков', prodLabel: 'Магазины и склад', prodWorker: 'продавцы и кладовщики',
    price: 3700, matCost: 2250, marketDemand: 40000, startShare: 0.07,
    staff: { prod: { n: 18, wage: 47000 }, sales: { n: 4, wage: 60000 }, admin: { n: 4, wage: 70000 } },
    laborPU: 162, startCapacity: 3300, capUnitCost: 2600, deprMonths: 84,
    overhead: 700000, season: [0.82, 0.86, 0.95, 0.96, 0.98, 0.95, 0.94, 1.0, 1.02, 1.04, 1.12, 1.36],
    volatility: 0.08, elasticity: 2.3, qW: 0.7, rW: 0.9, mW: 1.1,
    inventory: 'stock', perishRate: 0.01, storageRate: 0.01,
    receivable: { share: 0, lag: 0 },
    socialRate: 0.30, skillDecay: 0.1, wageInflation: 0.07, baseTurnover: 0.025, startSkill: 45,
    breakdown: 0.5, capitalIntensity: 0.5,
    competitors: [
      { name: 'МегаДом', priceK: 0.95, q: 50, rep: 58, aw: 2.6 },
      { name: 'Всё для дома', priceK: 1.0, q: 52, rep: 52, aw: 2.0 },
      { name: 'ДискаунтПлюс', priceK: 0.86, q: 38, rep: 44, aw: 1.9 }
    ],
    branch: { name: 'Новый магазин', cost: 9000000, months: 3, cap: 2600, demand: 16000, overhead: 520000, staff: 14 },
    products: ['Собственная марка', 'Интернет-магазин', 'Отдел товаров для сада', 'Премиальный ассортимент', 'Пункты выдачи'],
    tags: ['retail', 'stock']
  },
  construction: {
    id: 'construction', name: 'Строительство', short: 'Строительство',
    company: 'Строительная компания (жилые объекты)',
    desc: 'Крупные чеки, сезонность и длинные расчёты: заказчики платят поэтапно, деньги «застревают» в объектах.',
    features: ['Оплата 50% с отсрочкой 2 месяца', 'Зимой спрос падает', 'Дорогая техника и материалы'],
    risks: ['Кассовые разрывы', 'Штрафы за срыв сроков', 'Удорожание материалов'],
    opportunities: ['Госзаказ', 'Крупные девелоперы', 'Собственные проекты'],
    unit: 'м²', unitGen: 'м²', prodLabel: 'Строительные бригады', prodWorker: 'строители',
    price: 98000, matCost: 34000, marketDemand: 1500, startShare: 0.1,
    staff: { prod: { n: 60, wage: 70000 }, sales: { n: 4, wage: 70000 }, admin: { n: 8, wage: 82000 } },
    laborPU: 2.55, startCapacity: 165, capUnitCost: 260000, deprMonths: 96,
    overhead: 500000, season: [0.7, 0.74, 0.88, 1.02, 1.12, 1.16, 1.18, 1.16, 1.1, 1.02, 0.88, 0.76],
    volatility: 0.17, elasticity: 1.4, qW: 1.1, rW: 1.1, mW: 0.6,
    inventory: 'none', perishRate: 0, storageRate: 0,
    receivable: { share: 0.5, lag: 2 },
    socialRate: 0.30, skillDecay: 0.12, wageInflation: 0.08, baseTurnover: 0.02, startSkill: 50,
    breakdown: 1.2, capitalIntensity: 1.2,
    competitors: [
      { name: 'ГородСтрой', priceK: 1.02, q: 58, rep: 62, aw: 2.0 },
      { name: 'Монолит-Инвест', priceK: 0.98, q: 54, rep: 55, aw: 1.7 },
      { name: 'СтройДом', priceK: 0.9, q: 42, rep: 45, aw: 1.4 }
    ],
    branch: { name: 'Строительное подразделение в регионе', cost: 26000000, months: 4, cap: 110, demand: 900, overhead: 300000, staff: 40 },
    products: ['Коттеджи под ключ', 'Коммерческая недвижимость', 'Энергоэффективные дома', 'Реконструкция', 'Модульное строительство'],
    tags: ['capital', 'project']
  },
  it: {
    id: 'it', name: 'IT', short: 'IT',
    company: 'Компания заказной разработки ПО',
    desc: 'Главный актив — люди: высокая маржа, но дорогие и «текучие» специалисты, быстро устаревающие навыки.',
    features: ['Пониженные страховые взносы (7,6%)', 'Нет склада: продаются часы работы', 'Навыки устаревают без обучения'],
    risks: ['Переманивание разработчиков', 'Рост зарплат на рынке', 'Срыв дедлайнов'],
    opportunities: ['Собственный продукт (SaaS)', 'Зарубежные заказчики', 'Аутстаффинг'],
    unit: 'ч', unitGen: 'часов', prodLabel: 'Разработка', prodWorker: 'разработчики',
    price: 1900, matCost: 140, marketDemand: 60000, startShare: 0.08,
    staff: { prod: { n: 30, wage: 160000 }, sales: { n: 4, wage: 125000 }, admin: { n: 4, wage: 115000 } },
    laborPU: 160, startCapacity: 9000, capUnitCost: 900, deprMonths: 36,
    overhead: 640000, season: [0.9, 0.98, 1.02, 1.02, 1.0, 0.96, 0.9, 0.92, 1.04, 1.06, 1.08, 1.1],
    volatility: 0.09, elasticity: 1.3, qW: 1.3, rW: 1.0, mW: 0.8,
    inventory: 'none', perishRate: 0, storageRate: 0,
    receivable: { share: 0.4, lag: 1 },
    socialRate: 0.076, skillDecay: 0.55, wageInflation: 0.11, baseTurnover: 0.018, startSkill: 55,
    breakdown: 0.3, capitalIntensity: 0.2,
    competitors: [
      { name: 'КодЛаб', priceK: 1.05, q: 60, rep: 60, aw: 2.0 },
      { name: 'DigitalForge', priceK: 1.15, q: 68, rep: 66, aw: 2.1 },
      { name: 'ОфшорДев', priceK: 0.8, q: 42, rep: 42, aw: 1.6 }
    ],
    branch: { name: 'Офис разработки в другом городе', cost: 8000000, months: 3, cap: 6000, demand: 22000, overhead: 360000, staff: 20 },
    products: ['SaaS-платформа', 'Мобильная разработка', 'Data / ML-направление', 'Кибербезопасность', 'Внедрение ERP'],
    tags: ['people', 'service']
  },
  food: {
    id: 'food', name: 'Общественное питание', short: 'Общепит',
    company: 'Сеть кафе и ресторанов',
    desc: 'Репутация и отзывы решают всё: продукты портятся, персонал часто меняется, проверки строгие.',
    features: ['Продукты портятся: запасы сгорают', 'Выручка сразу, без отсрочек', 'Отзывы гостей быстро влияют на поток'],
    risks: ['Санитарные проверки', 'Высокая текучесть персонала', 'Рост цен на продукты'],
    opportunities: ['Доставка', 'Новые точки', 'Кейтеринг и банкеты'],
    unit: 'гость', unitGen: 'гостей', prodLabel: 'Кухня и зал', prodWorker: 'повара и официанты',
    price: 1200, matCost: 370, marketDemand: 60000, startShare: 0.08,
    staff: { prod: { n: 28, wage: 48000 }, sales: { n: 2, wage: 55000 }, admin: { n: 3, wage: 66000 } },
    laborPU: 176, startCapacity: 5600, capUnitCost: 2400, deprMonths: 72,
    overhead: 820000, season: [0.86, 0.88, 0.96, 0.98, 1.04, 1.1, 1.12, 1.1, 1.0, 0.96, 0.92, 1.08],
    volatility: 0.07, elasticity: 1.5, qW: 1.2, rW: 1.4, mW: 1.0,
    inventory: 'perish', perishRate: 0.35, storageRate: 0,
    receivable: { share: 0, lag: 0 },
    socialRate: 0.30, skillDecay: 0.12, wageInflation: 0.08, baseTurnover: 0.035, startSkill: 45,
    breakdown: 0.7, capitalIntensity: 0.6,
    competitors: [
      { name: 'Вкусно рядом', priceK: 0.9, q: 48, rep: 55, aw: 2.5 },
      { name: 'Гастробар «Печь»', priceK: 1.2, q: 66, rep: 64, aw: 1.8 },
      { name: 'Столовая №1', priceK: 0.75, q: 40, rep: 48, aw: 1.6 }
    ],
    branch: { name: 'Новое кафе', cost: 7500000, months: 3, cap: 3600, demand: 30000, overhead: 520000, staff: 18 },
    products: ['Доставка', 'Банкеты и кейтеринг', 'Сезонное меню', 'Кофейня to go', 'Здоровое питание'],
    tags: ['service', 'perish']
  }
};

/* Уровни сложности — значения можно менять в настройках вручную */
MS.DIFFICULTY = {
  easy:   { label: 'Лёгкий',   capitalMult: 1.6, volatilityMult: 0.6, competitorAggr: 0.6, taxRate: 0.2,  spread: 0.03, situationFreq: 0.8, wageInflMult: 0.7, bankruptcyMonths: 4, keyRate: 0.13 },
  normal: { label: 'Обычный',  capitalMult: 1.0, volatilityMult: 1.0, competitorAggr: 1.0, taxRate: 0.25, spread: 0.05, situationFreq: 1.0, wageInflMult: 1.0, bankruptcyMonths: 3, keyRate: 0.16 },
  hard:   { label: 'Сложный',  capitalMult: 0.65, volatilityMult: 1.4, competitorAggr: 1.4, taxRate: 0.25, spread: 0.07, situationFreq: 1.25, wageInflMult: 1.3, bankruptcyMonths: 2, keyRate: 0.18 }
};
MS.DIFF_FIELDS = [
  { k: 'capitalMult', label: 'Множитель стартового капитала', min: 0.3, max: 3, step: 0.05 },
  { k: 'volatilityMult', label: 'Колебания рынка (×)', min: 0, max: 2.5, step: 0.05 },
  { k: 'competitorAggr', label: 'Агрессивность конкурентов (×)', min: 0, max: 2.5, step: 0.05 },
  { k: 'taxRate', label: 'Налог на прибыль', min: 0, max: 0.4, step: 0.01, pct: true },
  { k: 'spread', label: 'Банковская маржа к ключевой ставке', min: 0, max: 0.15, step: 0.005, pct: true },
  { k: 'keyRate', label: 'Ключевая ставка на старте', min: 0.04, max: 0.25, step: 0.005, pct: true },
  { k: 'situationFreq', label: 'Частота управленческих ситуаций (×)', min: 0.3, max: 2, step: 0.05 },
  { k: 'wageInflMult', label: 'Рост зарплат на рынке (×)', min: 0, max: 2.5, step: 0.05 },
  { k: 'bankruptcyMonths', label: 'Месяцев с отрицательным балансом до банкротства', min: 1, max: 6, step: 1 }
];
