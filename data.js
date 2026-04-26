// =============================================================
// СЕМЕЙНОЕ ДЕРЕВО ЛЕВКИНЫХ
// Источник: Яндекс Формы + memorial-babushka + уточнения
// =============================================================

const YANDEX_FORM_URL = 'https://forms.yandex.ru/u/'; // заменить на реальный URL формы

// ----- ЛЮДИ -----
// gender: 'm' | 'f'
// born/died: строка даты (может быть неполной: "1925", "01.03.1956")
// maiden: девичья фамилия (если отличается от текущей)
// photo: путь к фото или null
// isEmpty: true если узел-заглушка (данных нет)
// isStepparent: true для отчима/мачехи
// isMain: true для центральной фигуры (Валентина)

const PEOPLE = {

  // ── ПОКОЛЕНИЕ I ──────────────────────────────────────────
  'ivan_kucherenko': {
    name: 'Кучеренко Иван Никифорович',
    born: '1897', died: null, gender: 'm', photo: null, maiden: null
  },
  'praskovya_kucherenko': {
    name: 'Кучеренко Прасковья Ивановна',
    born: null, died: null, gender: 'f', photo: null, maiden: null
  },

  // ── ПОКОЛЕНИЕ II ─────────────────────────────────────────
  'valentina_levkina': {
    name: 'Левкина Валентина Ивановна',
    born: '1925', died: '1985', gender: 'f',
    photo: 'photos/valentina.jpg', maiden: 'Кучеренко'
  },
  'fedor_levkin': {
    name: 'Левкин Фёдор Афанасьевич',
    born: '1920', died: '1974', gender: 'm', photo: null, maiden: null
  },

  // ── ПОКОЛЕНИЕ III — дети Валентины ───────────────────────
  'vladimir_levkin': {
    name: 'Левкин Владимир Николаевич',
    born: null, died: null, gender: 'm', photo: null, maiden: null
  },
  'natalya_levkina': {
    name: 'Левкина Наталья Фёдоровна',
    born: '01.03.1956', died: null, gender: 'f', photo: null, maiden: null
  },
  'irina_levkina': {
    name: 'Левкина Ирина Фёдоровна',
    born: '09.04.1965', died: null, gender: 'f', photo: null, maiden: null
  },

  // ── ПОКОЛЕНИЕ III — супруги детей Валентины ──────────────
  'zinchenko_victor': {
    name: 'Зинченко Виктор Михайлович',
    born: '24.09.1954', died: null, gender: 'm', photo: null, maiden: null
  },
  'zinchenko_mikhail': {
    name: 'Зинченко Михаил Михайлович',
    born: '13.07.1963', died: null, gender: 'm', photo: null, maiden: null
  },
  'zinchenko_mikhail_sr': {
    name: 'Зинченко Михаил (отец)',
    born: null, died: null, gender: 'm', photo: null, maiden: null, isEmpty: true
  },
  'ivlev_gennady': {
    name: 'Ивлев Геннадий Николаевич',
    born: '31.03.1964', died: '18.09.1998', gender: 'm', photo: null, maiden: null
  },
  'koronin_vladimir': {
    name: 'Боронин Владимир Владимирович',
    born: '13.04.1973', died: null, gender: 'm', photo: null, maiden: null, isStepparent: true
  },

  // ── ПОКОЛЕНИЕ III — родители Сергея Журбина (свойственники) ─
  'zhurbin_vladimir_sr': {
    name: 'Журбин Владимир Иванович',
    born: null, died: null, gender: 'm', photo: null, maiden: null
  },
  'rudakova_tatiana': {
    name: 'Журбина (Рудакова) Татьяна Владимировна',
    born: '27.12.1957', died: null, gender: 'f', photo: null, maiden: 'Рудакова'
  },

  // ── ПОКОЛЕНИЕ III — родители Никиты Рудичева (свойственники) ─
  'rudichev_gennady_sr': {
    name: 'Рудичев Геннадий Васильевич',
    born: '06.04.1964', died: '09.11.2021', gender: 'm', photo: null, maiden: null
  },
  'rudicheva_galina': {
    name: 'Рудичева (Литвинова) Галина Борисовна',
    born: '24.08.1961', died: null, gender: 'f', photo: null, maiden: 'Литвинова'
  },

  // ── ПОКОЛЕНИЕ III — родители Михаила Бондаренко (свойственники) ─
  'bondarenko_vladimir_sr': {
    name: 'Бондаренко Владимир Николаевич',
    born: '25.10.', died: null, gender: 'm', photo: null, maiden: null
  },
  'kapikova_natalya': {
    name: 'Бондаренко (Капикова) Наталья Михайловна',
    born: '01.01.1955', died: null, gender: 'f', photo: null, maiden: 'Капикова'
  },

  // ── ПОКОЛЕНИЕ IV — внуки Валентины (дети Натальи) ────────
  'marina_zinchenko': {
    name: 'Калентьева (Зинченко) Марина Викторовна',
    born: '07.02.1976', died: null, gender: 'f', photo: null, maiden: 'Зинченко'
  },
  'oksana_zhurbina': {
    name: 'Журбина (Зинченко) Оксана Викторовна',
    born: '07.03.1981', died: null, gender: 'f',
    photo: 'photos/oksana.jpg', maiden: 'Зинченко'
  },

  // ── ПОКОЛЕНИЕ IV — внуки Валентины (дети Ирины) ──────────
  'valentina_bondarenko': {
    name: 'Бондаренко (Ивлева) Валентина Геннадиевна',
    born: '03.04.1986', died: null, gender: 'f',
    photo: 'photos/valentina_b.jpg', maiden: 'Ивлева'
  },
  'rudicheva_olga': {
    name: 'Рудичева (Ивлева) Ольга Геннадиевна',
    born: '31.05.1988', died: null, gender: 'f', photo: null, maiden: 'Ивлева'
  },
  'rudichev_nikita': {
    name: 'Рудичев Никита Геннадьевич',
    born: '11.01.1990', died: null, gender: 'm', photo: null, maiden: null
  },

  // ── ПОКОЛЕНИЕ IV — супруги внуков ────────────────────────
  'kalentev_petr': {
    name: 'Калентьев Пётр Николаевич',
    born: '06.09.1977', died: null, gender: 'm', photo: null, maiden: null
  },
  'zhurbin_sergei': {
    name: 'Журбин Сергей',
    born: '21.01.1980', died: null, gender: 'm', photo: null, maiden: null
  },
  'bondarenko_mikhail': {
    name: 'Бондаренко Михаил Владимирович',
    born: '04.12.1981', died: null, gender: 'm', photo: null, maiden: null
  },

  // ── ПОКОЛЕНИЕ IV — Киселева Елена (сестра Петра) ────────
  // Связана с деревом: её брат Пётр женат на Марине Зинченко
  'kalenteva_elena': {
    name: 'Киселева (Калентьева) Елена Николаевна',
    born: '18.11.1974', died: null, gender: 'f', photo: null, maiden: 'Калентьева'
  },

  // ── ПОКОЛЕНИЕ IV — муж Елены (в разводе) ─────────────────
  'kiselev_dmitry': {
    name: 'Киселев Дмитрий Викторович',
    born: '10.11.1972', died: null, gender: 'm', photo: null, maiden: null
  },

  // ── ПОКОЛЕНИЕ V — дети Петра и Марины ───────────────────
  'kalentev_timofey': {
    name: 'Калентьев Тимофей Петрович',
    born: '24.05.2002', died: null, gender: 'm', photo: null, maiden: null
  },

  // ── ПОКОЛЕНИЕ V — правнуки Валентины (дети Оксаны) ───────
  'yana_zhurbina': {
    name: 'Журбина Яна Сергеевна',
    born: '12.12.2015', died: null, gender: 'f', photo: null, maiden: null
  },
  'inna_zhurbina': {
    name: 'Журбина Инна Сергеевна',
    born: '03.09.2018', died: null, gender: 'f', photo: null, maiden: null
  },

  // ── ПОКОЛЕНИЕ V — правнуки Валентины (дети Валентины Б.) ─
  'anna_bondarenko': {
    name: 'Бондаренко Анна Михайловна',
    born: '24.08.2004', died: null, gender: 'f', photo: null, maiden: null
  },

  // ── ПОКОЛЕНИЕ V — дети Ольги Рудичевой ───────────────────
  'krutkin_roman': {
    name: 'Круткин Роман Антонович',
    born: '06.09.2012', died: null, gender: 'm', photo: null, maiden: null
  },
  'rudichev_fedor': {
    name: 'Рудичев Фёдор Никитич',
    born: '18.03.2021', died: null, gender: 'm', photo: null, maiden: null
  },

  // ── ПОКОЛЕНИЕ V — дети Елены Калентьевой ─────────────────
  'evgeny_kalentev': {
    name: 'Калентьев Евгений',
    born: '08.05.1993', died: null, gender: 'm',
    photo: 'photos/evgeny.jpg', maiden: null
  },
  'egor_kiselev': {
    name: 'Киселев Егор',
    born: '11.10.2001', died: null, gender: 'm', photo: null, maiden: null
  },

  // ── ПОКОЛЕНИЕ V — жена Егора ──────────────────────────────
  'marina_zhuravleva': {
    name: 'Киселева (Журавлёва) Марина Андреевна',
    born: '21.11.2002', died: null, gender: 'f', photo: null, maiden: 'Журавлёва'
  },

  // ── ПОКОЛЕНИЕ IV — родители Марины Журавлёвой (свойственники) ─
  'zhuravlev_andrei': {
    name: 'Журавлёв Андрей Анатольевич',
    born: '30.04.1980', died: null, gender: 'm', photo: null, maiden: null
  },
  'gun_natalya': {
    name: 'Гунь Наталья Александровна',
    born: '09.09.1979', died: null, gender: 'f', photo: null, maiden: null
  },
  'gun_marina': {
    name: 'Гунь Марина Александровна',
    born: '12.06.1973', died: null, gender: 'f', photo: null, maiden: null
  },

  // ── ПОКОЛЕНИЕ V — сын Журавлёвых ─────────────────────────
  'zhuravlev_egor': {
    name: 'Журавлёв Егор Андреевич',
    born: '24.05.2010', died: null, gender: 'm', photo: null, maiden: null
  },

  // ── ПОКОЛЕНИЕ VI — праправнуки ───────────────────────────
  'arseny_kalentev': {
    name: 'Калентьев Арсений',
    born: '2013', died: null, gender: 'm', photo: null, maiden: null
  },
  'avrora_kiseleva': {
    name: 'Киселева Аврора Игоревна',
    born: '15.06.2024', died: null, gender: 'f', photo: null, maiden: null
  },

  // ── Муж Анны Бондаренко ───────────────────────────────────
  'kosminik': {
    name: 'Косьминик',
    born: null, died: null, gender: 'm', photo: null, maiden: null
  }
};

// ----- ПАРЫ И СВЯЗИ -----
// p1, p2: ID людей (p2 может быть null для одиночного родителя)
// children: ID детей
// isStep: true для отношений с отчимом (пунктирная линия)
// isInlaw: true для "внешних" пар (родители супругов), не входят в основное дерево
// weddingDate: дата свадьбы (строка)

const COUPLES = [

  // ── ПОКОЛЕНИЕ I ──────────────────────────────────────────
  {
    id: 'c_kucherenko',
    p1: 'ivan_kucherenko', p2: 'praskovya_kucherenko',
    children: ['valentina_levkina']
  },

  // ── ПОКОЛЕНИЕ II ─────────────────────────────────────────
  {
    id: 'c_levkin',
    p1: 'valentina_levkina', p2: 'fedor_levkin',
    children: ['vladimir_levkin', 'natalya_levkina', 'irina_levkina']
  },

  // ── ПОКОЛЕНИЕ III ────────────────────────────────────────
  {
    id: 'c_natalya',
    p1: 'natalya_levkina', p2: 'zinchenko_victor',
    children: ['marina_zinchenko', 'oksana_zhurbina']
  },
  {
    id: 'c_irina_bio',
    p1: 'irina_levkina', p2: 'ivlev_gennady',
    children: ['valentina_bondarenko', 'rudicheva_olga'], isStep: true
  },
  {
    id: 'c_irina_step',
    p1: 'irina_levkina', p2: 'koronin_vladimir',
    children: []
  },

  // Отец Виктора и Михаила Зинченко (свойственники)
  {
    id: 'c_zinchenko_parents',
    p1: 'zinchenko_mikhail_sr', p2: null,
    children: ['zinchenko_victor', 'zinchenko_mikhail'], isInlaw: true
  },

  // Родители Рудичева Никиты (свойственники)
  {
    id: 'c_rudichev_parents',
    p1: 'rudichev_gennady_sr', p2: 'rudicheva_galina',
    children: ['rudichev_nikita'], isInlaw: true
  },

  // Родители Журбина Сергея (свойственники)
  {
    id: 'c_zhurbin_parents',
    p1: 'zhurbin_vladimir_sr', p2: 'rudakova_tatiana',
    children: ['zhurbin_sergei'], isInlaw: true
  },

  // Родители Бондаренко Михаила (свойственники)
  {
    id: 'c_bondarenko_parents',
    p1: 'bondarenko_vladimir_sr', p2: 'kapikova_natalya',
    children: ['bondarenko_mikhail'], isInlaw: true
  },

  // ── ПОКОЛЕНИЕ IV ─────────────────────────────────────────
  {
    id: 'c_marina_z',
    p1: 'marina_zinchenko', p2: 'kalentev_petr',
    children: ['kalentev_timofey'], weddingDate: null
  },
  {
    id: 'c_oksana',
    p1: 'oksana_zhurbina', p2: 'zhurbin_sergei',
    children: ['yana_zhurbina', 'inna_zhurbina'],
    weddingDate: '13.07.2013'
  },
  {
    id: 'c_valentina_b',
    p1: 'valentina_bondarenko', p2: 'bondarenko_mikhail',
    children: ['anna_bondarenko'],
    weddingDate: '28.02.2009'
  },
  {
    id: 'c_olga',
    p1: 'rudicheva_olga', p2: 'rudichev_nikita',
    children: ['krutkin_roman', 'rudichev_fedor'],
    weddingDate: '26.10.2019'
  },

  // Елена Калентьева — одиночный родитель (отец Евгения неизвестен)
  {
    id: 'c_elena_evgeny',
    p1: 'kalenteva_elena', p2: null,
    children: ['evgeny_kalentev']
  },

  // Елена + Киселев Дмитрий (в разводе; пунктиром)
  {
    id: 'c_elena_egor',
    p1: 'kalenteva_elena', p2: 'kiselev_dmitry',
    children: ['egor_kiselev'], isStep: true,
    weddingDate: '02.06.2001', divorceDate: '24.10.2005'
  },

  // ── ПОКОЛЕНИЕ V ──────────────────────────────────────────
  // Евгений Калентьев — одиночный родитель
  {
    id: 'c_evgeny',
    p1: 'evgeny_kalentev', p2: null,
    children: ['arseny_kalentev']
  },
  {
    id: 'c_egor',
    p1: 'egor_kiselev', p2: 'marina_zhuravleva',
    children: ['avrora_kiseleva'],
    weddingDate: '29.11.2023'
  },

  // Родители Марины Журавлёвой (свойственники)
  {
    id: 'c_zhuravlev_parents',
    p1: 'zhuravlev_andrei', p2: 'gun_natalya',
    children: ['marina_zhuravleva', 'zhuravlev_egor'], isInlaw: true
  },

  // Анна Бондаренко + Косьминик (данных мало)
  {
    id: 'c_anna_b',
    p1: 'anna_bondarenko', p2: 'kosminik',
    children: []
  }
];

// ----- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ -----

// Получить пару по ID
function getCoupleById(id) {
  return COUPLES.find(c => c.id === id);
}

// Найти все пары, где человек является p1 или p2
function getCouplesForPerson(personId) {
  return COUPLES.filter(c => c.p1 === personId || c.p2 === personId);
}

// Найти родительскую пару для человека (где он числится как child)
function getParentCouple(personId) {
  return COUPLES.find(c => c.children && c.children.includes(personId));
}

// Дополнительная информация для связей в боковой панели
function getRelatives(personId) {
  const result = { parents: null, spouse: null, children: [], siblings: [] };

  // Родители
  const parentCouple = getParentCouple(personId);
  if (parentCouple) {
    result.parents = { p1: parentCouple.p1, p2: parentCouple.p2 };
    // Братья/сёстры
    result.siblings = parentCouple.children.filter(id => id !== personId);
  }

  // Супруг (только из не-step пар) и дети (из всех пар)
  for (const couple of getCouplesForPerson(personId)) {
    if (!couple.isStep) {
      const spouseId = couple.p1 === personId ? couple.p2 : couple.p1;
      if (spouseId && !result.spouse) result.spouse = spouseId;
    }
    result.children.push(...couple.children);
  }

  return result;
}

