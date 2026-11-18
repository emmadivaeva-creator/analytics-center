/** Aggregated VIO demand trends. Raw questions are never returned to the public UI. */
const VIO_TRENDS_SOURCE_ID_ = '1ENnwfKY_fqyr4-81pjUDY3gsfcu_vf9zVnuifiR_5XU';
// 18.11.2026 exports. The newer CSVs take precedence by (direction, ID).
const VIO_TRENDS_EXTRA_IDS_ = [
  '1yGh2MyOV4UNOCQ-uUBk4_s2qQIPNXiwikwL_u6eLkoY', // ГФ, /qa/
  '1fSoZZc0l3-W9p7fdqo_IqspE6HEAW-B5kzqKTolDNXU'  // ГЗ, /question/
];

function getVioTrendsUi(force) {
  requireDashboardOwner_();
  const cache = CacheService.getScriptCache();
  // A YYYY-MM argument selects a historical month; 1 forces a fresh latest read.
  const selectedMonth = typeof force === 'string' && /^\d{4}-\d{2}$/.test(force) ? force : '';
  const cacheKey = 'vio-trends-v9-all:' + (selectedMonth || 'latest');
  if (force !== 1 && force !== '1') {
    try {
      const cached = cache.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {}
  }

  const books = [VIO_TRENDS_SOURCE_ID_].concat(VIO_TRENDS_EXTRA_IDS_).map(function(id){return SpreadsheetApp.openById(id);});
  const byId = {};

  books.forEach(function(book, priority) {
  book.getSheets().forEach(function(sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const width = Math.min(17, sheet.getLastColumn());
    const rows = sheet.getRange(1, 1, lastRow, width).getDisplayValues();
    const headers = rows[0] || [];
    const idx = {};
    headers.forEach(function(h, i) { idx[String(h || '').trim()] = i; });
    if (idx.ID == null || idx['Заголовок'] == null || idx['Вопрос'] == null || idx['Дата публикации'] == null) return;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const id = String(row[idx.ID] || '').trim();
      if (!id) continue;
      const date = vioDate_(row[idx['Дата публикации']]);
      const question = String(row[idx['Вопрос']] || '').trim();
      if (!date || !question) continue;
      const title = String(row[idx['Заголовок']] || '').trim();
      const rubric = String(
        (idx['Ведущая рубрика'] != null ? row[idx['Ведущая рубрика']] : '') ||
        (idx['Рубрики'] != null ? row[idx['Рубрики']] : '') || ''
      ).trim();
      const url = String(idx.URL != null ? row[idx.URL] || '' : '').trim();
      const direction = vioDirection_(url, rubric, title, question);
      if (!direction) continue;
      const modified = String(idx['Дата последнего изменения'] != null ? row[idx['Дата последнего изменения']] || '' : '');
      const item = {id:id,date:date,month:date.slice(0,7),modified:modified,direction:direction,rubric:rubric,title:title,question:question};
      const key = direction + '|' + id;
      if (!byId[key] || priority > 0 || modified >= byId[key].modified) byId[key] = item;
    }
  });
  });

  const items = Object.keys(byId).map(function(id) { return byId[id]; });
  const months = Array.from(new Set(items.map(function(x){return x.month;}))).sort();
  if (selectedMonth && months.indexOf(selectedMonth) < 0) {
    throw new Error('За выбранный месяц в выгрузке ВИО нет данных: ' + selectedMonth);
  }
  const currentMonth = selectedMonth || (months.length ? months[months.length - 1] : '');
  const index = months.indexOf(currentMonth);
  const previousMonth = index > 0 ? months[index - 1] : '';
  const latestMonth = months.length ? months[months.length - 1] : '';
  const actualMonth = Utilities.formatDate(new Date(), 'Europe/Moscow', 'yyyy-MM');
  const currentMonthInt = Number(actualMonth.slice(0,4))*12+Number(actualMonth.slice(5,7));
  const latestMonthInt = Number(latestMonth.slice(0,4))*12+Number(latestMonth.slice(5,7));
  const monthsBehind = latestMonth ? Math.max(0,currentMonthInt-latestMonthInt) : null;

  const result = {
    meta: {
      sourceTitle: 'Объединённый архив ВИО: август–ноябрь 2026',
      readAt: new Date().toISOString(),
      availableMonths: months,
      latestMonth: latestMonth,
      latestLabel: vioMonthLabel_(latestMonth),
      monthsBehind: monthsBehind,
      currentMonth: currentMonth,
      previousMonth: previousMonth,
      currentLabel: vioMonthLabel_(currentMonth),
      previousLabel: vioMonthLabel_(previousMonth),
      totalRows: items.length
    },
    groups: {
      'ГЗ': vioGroup_(items, 'ГЗ', currentMonth, previousMonth),
      'ГФ': vioGroup_(items, 'ГФ', currentMonth, previousMonth)
    },
    monthly: vioMonthly_(items,months),
    drilldown: vioDrilldown_(items,months,latestMonth)
  };

  try {
    const json = JSON.stringify(result);
    if (json.length < 95000) cache.put(cacheKey, json, 600);
  } catch (e) {}
  return result;
}


/** Month-by-month topic distribution for both directions. No raw question text in public output. */
function vioMonthly_(items, months) {
  const result = {};
  ['ГФ','ГЗ'].forEach(function(direction) {
    const directionRows = items.filter(function(row){return row.direction === direction;});
    const periods = months.map(function(month) {
      const rows = directionRows.filter(function(row){return row.month === month;});
      const counts = {};
      rows.forEach(function(row){
        const topic = vioTopic_(direction,row.rubric,row.title,row.question);
        counts[topic] = (counts[topic] || 0) + 1;
      });
      const days = vioCoverageDays_(rows);
      return {
        month:month,label:vioMonthLabel_(month),
        count:rows.length,days:days,pace:days?vioRound_(rows.length/days,1):0,
        topics:counts
      };
    });
    const topicNames = {};
    periods.forEach(function(period) {
      Object.keys(period.topics).forEach(function(topic){topicNames[topic]=true;});
    });
    const topics = Object.keys(topicNames).map(function(name) {
      const counts = {}, shares = {};
      let total=0;
      periods.forEach(function(period) {
        const n = period.topics[name] || 0;
        counts[period.month] = n;
        shares[period.month] = period.count ? vioRound_(n/period.count*100,1) : 0;
        total += n;
      });
      return {name:name,total:total,counts:counts,shares:shares};
    }).sort(function(a,b){return b.total-a.total;});
    result[direction] = {periods:periods,topics:topics};
  });
  return result;
}


/** Topic-specific second level for the five biggest VIO topics in each direction.
 * Each question gets exactly one subtopic, by title first and by question second.
 * No raw question text or identifying information is returned to the dashboard.
 */
const VIO_DETAIL_RULES_ = Object.freeze({
  'ГЗ|223-ФЗ': [
    ['Положение о закупке и внутренние правила',/положени.*закуп|порядок.*закуп|корректиров.*положени|размещени.*положени/i],
    ['МСП / СМСП и квоты',/\bмсп\b|\bсмсп\b|\bсмп\b|мал.*предпринимател|субъект.*предпринимател/i],
    ['Нацрежим и происхождение товаров',/нацрежим|национальн.*режим|1875|российск.*происхожд|иностранн.*товар|рппп?|гисп|стран.*происхожд|запрет.*иностранн/i],
    ['Планирование закупок',/план.*закуп|планирован.*закуп|план.?график/i],
    ['ЕИС, реестр договоров и публикация',/еис|реестр.*договор|размещени.*договор|публикац|опубликован|срок.*размещ|протокол.*размещ/i],
    ['Закупка у единственного поставщика',/единственн.*постав|единственн.*исполн|без.*конкурентн|неконкурентн/i],
    ['Конкурсы, аукционы и способы закупки',/аукцион|котировк|конкурс|запрос.*предложен|конкурентн.*закуп|электронн.*процедур|способ.*закуп|торг/i],
    ['Требования к участникам и заявки',/участник|заявк|отклон|допуск|оценк|критери|документ.*участ|антидемпинг|обеспечени.*заяв/i],
    ['Заключение и изменение договора',/договор|контракт|допсоглаш|протокол.*разноглас|расторж|изменен.*услов|услов.*договор/i],
    ['Оплата, приёмка, гарантии и санкции',/оплат|приемк|приёмк|неустойк|штраф|гарант|исполнени|срок.*постав|срок.*оплат/i],
    ['Цена и обоснование НМЦД',/нмцд|нмцк|обоснован.*цен|начальн.*цен|цена.*договор|стоимост/i],
    ['Отчётность и объём закупок',/сгоз|ежемесячн.*отчет|годов.*отчет|отчет.*закуп|отчёт.*закуп|объем.*закуп|объём.*закуп/i],
    ['Жалобы, контроль и проверки',/фас|жалоб|провер|контрол|нарушен|предписан|административн/i],
    ['Конкретные товары, работы и услуги',/лекарств|медиздел|строител|ремонт|топлив|гсм|программн.*обеспеч|лицензи|оборудован|услуг.*связи/i]
  ],
  'ГЗ|Исполнение, приемка, оплата, неустойка': [
    ['Приёмка, экспертиза, документы',/приемк|приёмк|экспертиз|акт.*прием|акт.*приём|товарн.*накладн|закрывающ.*документ/i],
    ['Сроки и порядок оплаты',/оплат|задерж.*платеж|задерж.*оплат|перечислен.*денеж|аванс|финансирован/i],
    ['Неустойка, пени, штрафы',/неустойк|пени|пеня|штраф|просрочк|санкци/i],
    ['Расторжение и односторонний отказ',/расторж|односторонн.*отказ|прекращени.*контракт/i],
    ['Гарантийные обязательства',/гаранти|обеспечени.*исполнен|возврат.*обеспечен/i],
    ['Изменение сроков, объёмов и этапов исполнения',/срок.*исполн|срок.*постав|этап|объем.*работ|объём.*работ|изменени.*контракт/i],
    ['Отражение исполнения в ЕИС и реестрах',/еис|реестр.*контракт|электронн.*акт|цифров.*контракт/i],
    ['Нарушения поставщика и претензии',/поставщик|подрядчик|неисполн|ненадлежащ|некачествен|претенз/i]
  ],
  'ГЗ|Нацрежим и российское происхождение': [
    ['Исключения и случаи неприменения',/исключен|не примен|не распростр|можно.*без.*запрет|отсутстви.*аналог|менее.*(?:50|100).*тыс/i],
    ['Запреты на иностранные товары и ПО',/запрет|не допуска|иностранн.*по\b|программн.*обеспеч/i],
    ['Ограничения допуска',/ограничен|второй.*лишн|допуск/i],
    ['Преимущество российской продукции',/преимущ|преференц|балл.*российск/i],
    ['Реестры РРПП, ГИСП и подтверждение',/рппп?|гисп|реестр.*продук|реестров.*запис|подтвержден|выписк.*реестр/i],
    ['Страна происхождения и документы',/стран.*происхожд|сертификат|ст.?1|декларац.*происхожд/i],
    ['Отклонение и проверка заявок',/отклон|заявк|несоответств|провер.*участник/i],
    ['НМЦК и запрос цен при нацрежиме',/нмцк|ценов.*информац|запрос.*цен|обоснован.*цен/i],
    ['Закупка у единственного поставщика',/единственн.*постав|единственн.*исполн/i],
    ['Медицинские изделия и лекарства',/медиздел|лекарств|медицинск/i],
    ['Отдельные товарные группы',/оборудован|картридж|мебел|питани|текстил|автомоб|одежд/i],
    ['Применение постановления № 1875',/1875|национальн.*режим|нацрежим/i]
  ],
  'ГЗ|Изменение условий контракта': [
    ['Изменение цены, НДС и стоимости',/цен|стоимост|ндс|увеличени.*сумм|уменьшени.*сумм|индексац/i],
    ['Объём работ, количество и допработы',/объем|объём|количеств|дополнительн.*работ|исключени.*работ/i],
    ['Продление и перенос сроков',/срок|продлен|продлить|перенос.*дат|просрочк/i],
    ['Дополнительное соглашение и основания',/допсоглаш|дополнительн.*соглаш|существенн.*услов|изменени.*услов/i],
    ['Аванс, оплата и этапы',/аванс|этап|оплат|платеж|рассрочк/i],
    ['Предмет, характеристики и качество',/характеристик|спецификац|предмет|качест|замен.*товар/i],
    ['Смета, проект и строительные работы',/смет|проектн.*документ|капремонт|строител|ремонт/i],
    ['Источники финансирования',/источник.*финанс|субсид|лимит|бюджетн.*обязательств/i],
    ['ЕИС и оформление изменений',/еис|реестр|размещ|оформ|исправлен.*документ/i],
    ['Расторжение и отказ вместо изменения',/расторж|отказ.*исполн/i]
  ],
  'ГЗ|Заявки и требования к участникам': [
    ['Отклонение и допуск заявки',/отклон|допуск|не допуст|отказ.*участ|несоответств|недостоверн/i],
    ['Опыт, квалификация, оценка',/опыт|квалификац|критери.*оцен|оценк.*заяв|балл/i],
    ['Лицензии, СРО и разрешения',/лицензи|сро|разрешени|аккредитац/i],
    ['Единые и дополнительные требования',/дополнительн.*требован|един.*требован|требован.*участ|427.?фз|2571/i],
    ['Состав заявки и документы',/состав.*заяв|документ.*заяв|сведени.*заяв|заполнени.*заяв|подач.*заяв/i],
    ['Нацрежим в заявках',/нацрежим|1875|происхожд|российск.*товар|преимуществ/i],
    ['Обеспечение заявки и гарантии',/обеспечени.*заяв|независим.*гарант|банковск.*гарант/i],
    ['Рассмотрение, протоколы, победитель',/рассмотрени|комисси|протокол|победител|аукцион|котировк/i],
    ['Характеристики, ТЗ и КТРУ',/ктру|характеристик|технич.*задан|описан.*объект|спецификац/i],
    ['РНП, ограничения и конфликт интересов',/рнп|недобросовест|аффилирован|конфликт.*интерес|учредител/i]
  ],
  'ГФ|Имущество: ОС, МЗ, списание, инвентаризация': [
    ['Списание и выбытие имущества',/списан|списать|выбыт|ликвидац|утилизац/i],
    ['Инвентаризация, комиссия, сверка',/инвентаризац|инвентарн|комисс|сверк/i],
    ['Поступление, принятие к учёту и оценка',/принять.*учет|принять.*учёт|поступлен|оприход|постановк.*учет|первоначальн.*стоим|оценк.*имуществ/i],
    ['Передача имущества и казна',/передач|передать|казн|безвозмезд|оперативн.*управлен/i],
    ['Амортизация и срок службы',/амортизац|полезн.*использ|износ/i],
    ['Ремонт, модернизация, капитальные вложения',/ремонт|модернизац|реконструк|капитальн.*вложен|строител/i],
    ['Основные средства и НФА',/основн.*средств|\bнфа\b|счет.*101|недвижим|объект.*ос\b/i],
    ['Материальные запасы',/материал.*запас|матзапас|счет.*105|картридж|мягк.*инвентар|мебел/i],
    ['НМА, лицензии и права пользования',/\bнма\b|нематериал|прав.*пользован|лицензи|программн.*обеспеч/i],
    ['Транспорт, ГСМ и оборудование',/автомоб|транспорт|гсм|топлив|оборудован|оргтех/i],
    ['Учётные документы и инвентарные карточки',/инвентарн.*карточ|первичн.*документ|акт|форм.*05\d+/i]
  ],
  'ГФ|Проводки, счета, доходы и расходы': [
    ['Возвраты, переплаты и возмещения',/возврат|переплат|возмещен|компенсац.*затрат/i],
    ['Дебиторка, кредиторка и расчёты',/дебитор|кредитор|задолж|расчет.*поставщик|расчёт.*поставщик|подотчет/i],
    ['Субсидии, гранты и госзадание',/субсид|грант|госзадан|целев.*финанс/i],
    ['НДФЛ, НДС, ЕНП и взносы',/ндфл|ндс|енп|налог|страхов.*взнос/i],
    ['Зарплата и расчёты с сотрудниками',/зарплат|преми|оплат.*труд|работник|командиров/i],
    ['Аренда и пользование имуществом',/аренд|сервитут|безвозмездн.*польз/i],
    ['Учёт доходов и платных услуг',/доход|платн.*услуг|выручк|реализац|продаж/i],
    ['Расходы, затраты и себестоимость',/расход|затрат|себестоим|коммунальн/i],
    ['Счета 101/105, имущество и НМА',/101\.|105\.|имуществ|основн.*средств|матзапас|нма\b|нематериал/i],
    ['Корректировки и исправление проводок',/ошибк|исправлен|сторно|корректиров|перенос.*остатк/i],
    ['Учётные счета и корреспонденция',/проводк|дебет|кредит|счет.*[0123456789]{3}|счёт/i]
  ],
  'ГФ|КВР, КОСГУ, КБК': [
    ['Матзапасы / ОС: КОСГУ 310 и 340',/косгу.*(310|34\d)|\b310\b|\b34\d\b|основн.*средств|материал.*запас/i],
    ['Услуги и работы: 225 / 226',/косгу.*(225|226)|\b225\b|\b226\b|содержани.*имуществ|выполнени.*работ/i],
    ['Выплаты персоналу: КВР и КОСГУ',/зарплат|преми|компенсац.*работник|выплат.*работник|выходн.*пособ|оплат.*труд/i],
    ['КБК и бюджетная классификация',/кбк|бюджетн.*классификац|кпс|квр.*код/i],
    ['Программное обеспечение и IT-расходы',/программн.*обеспеч|лицензи|облачн|электронн.*сервис|сайт|ит.*услуг/i],
    ['Ремонт, монтаж и капитальные вложения',/ремонт|монтаж|модернизац|капитальн|строител/i],
    ['Налоги, штрафы и судебные расходы',/налог|штраф|пени|госпошлин|судебн/i],
    ['Субсидии, доходы и возвраты',/субсид|грант|доход|возврат|возмещен/i],
    ['Аренда и коммунальные услуги',/аренд|коммунальн|электроэнерг|теплоснабж/i],
    ['Закупка товаров и оборудования',/закуп|приобретен|оборудован|товар/i],
    ['Выбор кода КОСГУ / КВР',/косгу|квр|код.*расход/i]
  ],
  'ГФ|Зарплата и выплаты': [
    ['МРОТ и доплата до минимума',/мрот|минимальн.*оплат|доплат.*минимум/i],
    ['Сверхурочные, выходные и праздники',/сверхуроч|выходн.*дн|праздничн.*дн|ненормирован|ночн.*смен/i],
    ['Премии, надбавки и стимулирующие',/преми|надбавк|стимулирующ|районн.*коэффициент|северн.*надбав/i],
    ['Расчёт среднего заработка',/средн.*заработ|среднедневн|расчет.*средн|расчёт.*средн/i],
    ['Отпускные и компенсация отпуска',/отпуск|компенсац.*отпуска/i],
    ['Больничные, пособия и декрет',/больнич|пособ|декрет|лист.*нетрудоспособ/i],
    ['Удержания из зарплаты',/удержан|алименты|профвзнос|исполнительн.*лист/i],
    ['Матпомощь, выплаты и компенсации',/материал.*помощ|компенсац|единовременн.*выплат|выплат.*сотрудник/i],
    ['Совместительство и дополнительная работа',/совместител|совмещени|дополнительн.*работ|нагрузк|замещени/i],
    ['Начисление и перерасчёт зарплаты',/начислен|расчет.*зарплат|расчёт.*зарплат|перерасчет|перерасчёт|оплат.*труд/i],
    ['Кадровые приказы и оформление',/приказ|положени.*оплат|трудов.*договор|штатн/i]
  ],
  'ГФ|Налоги и взносы': [
    ['НДС: начисление, освобождение и вычеты',/ндс|налог.*добавленн/i],
    ['НДФЛ: удержание и вычеты',/ндфл|вычет.*налог|налог.*доход.*физическ/i],
    ['Страховые взносы и травматизм',/страхов.*взнос|травматизм|сфр|фонд.*социальн/i],
    ['Налог на прибыль',/налог.*прибыл|прибыл.*налог/i],
    ['Налог на имущество',/налог.*имуществ|имущественн.*налог/i],
    ['Земельный и транспортный налог',/земельн.*налог|транспортн.*налог/i],
    ['ЕНП, ЕНС и уплата налогов',/\bенп\b|\bенс\b|един.*налогов.*платеж|переплат.*налог|уплат.*налог/i],
    ['Декларации, уведомления и отчётность',/декларац|уведомлен.*налог|отчет.*налог|отчёт.*налог|срок.*подач/i],
    ['Льготы, освобождения и ставки',/льгот|освобожден|ставк.*налог/i],
    ['Прочие налоги и сборы',/налог|сбор|госпошлин/i]
  ]
});

function vioDrillClassify_(direction,topic,item) {
  const title=vioNorm_(item.title);
  const question=vioNorm_(item.question);
  if(direction==='ГЗ'&&topic==='223-ФЗ') {
    const explicit223=/(?:\b223\s*[- ]?\s*фз\b|закон(?:у|а|ом)?\s*(?:№\s*)?223\b)/i.test(title+' '+question);
    const explicit44=/(?:\b44\s*[- ]?\s*фз\b|закон(?:у|а|ом)?\s*(?:№\s*)?44\b)/i.test(title+' '+question);
    if(explicit44&&!explicit223)return 'Упоминается 44-ФЗ без 223-ФЗ: проверить рубрику';
  }
  const rules=VIO_DETAIL_RULES_[direction+'|'+topic]||[];
  for(const text of [title,question]) {
    for(const entry of rules) {
      if(entry[1].test(text))return entry[0];
    }
  }
  return 'Прочие случаи внутри темы';
}

/** Top five topic drilldowns, including all-month series and mutually exclusive subtopics. */
function vioDrilldown_(items,months,latest) {
  const result={};
  ['ГЗ','ГФ'].forEach(function(direction){
    const inDirection=items.filter(function(row){return row.direction===direction;});
    const latestRows=inDirection.filter(function(row){return row.month===latest;});
    const ranking={};
    latestRows.forEach(function(row){
      const topic=vioTopic_(direction,row.rubric,row.title,row.question);
      if(topic==='Другие вопросы')return;
      ranking[topic]=(ranking[topic]||0)+1;
    });
    const names=Object.keys(ranking).sort(function(a,b){return ranking[b]-ranking[a];}).slice(0,5);
    const topics=names.map(function(topic){
      const sub={};const parentCounts={};
      inDirection.forEach(function(row){
        if(vioTopic_(direction,row.rubric,row.title,row.question)!==topic)return;
        const month=row.month;
        parentCounts[month]=(parentCounts[month]||0)+1;
        const name=vioDrillClassify_(direction,topic,row);
        if(!sub[name])sub[name]={name:name,total:0,counts:{}};
        sub[name].total++;
        sub[name].counts[month]=(sub[name].counts[month]||0)+1;
      });
      const subtopics=Object.keys(sub).map(function(name){
        const val=sub[name],counts={},shares={};
        months.forEach(function(month){
          const amount=val.counts[month]||0;
          counts[month]=amount;
          shares[month]=parentCounts[month]?vioRound_(amount/parentCounts[month]*100,1):0;
        });
        return {name:name,total:val.total,counts:counts,shares:shares,
          latestCount:counts[latest]||0,latestShare:shares[latest]||0};
      }).sort(function(a,b){return b.latestCount-a.latestCount||b.total-a.total;});
      return {name:topic,latestCount:ranking[topic],total:Object.keys(parentCounts).reduce(function(s,m){return s+parentCounts[m];},0),
        counts:parentCounts,subtopics:subtopics};
    });
    result[direction]={months:months,latest:latest,topics:topics};
  });
  return result;
}

function vioGroup_(items, direction, currentMonth, previousMonth) {
  const current = items.filter(function(x){return x.direction===direction && x.month===currentMonth;});
  const previous = items.filter(function(x){return x.direction===direction && x.month===previousMonth;});
  current.forEach(function(x){
    x.topic = vioTopic_(direction,x.rubric,x.title,x.question);
    x.intent = vioIntent_(direction,x.title,x.question);
    x.action = vioAction_(direction,x.title,x.question);
    x.object = vioObject_(direction,x.rubric,x.title,x.question);
  });
  previous.forEach(function(x){
    x.topic = vioTopic_(direction,x.rubric,x.title,x.question);
    x.intent = vioIntent_(direction,x.title,x.question);
    x.action = vioAction_(direction,x.title,x.question);
    x.object = vioObject_(direction,x.rubric,x.title,x.question);
  });

  const currTopics = vioCount_(current, function(x){return x.topic;});
  const prevTopics = vioCount_(previous, function(x){return x.topic;});
  const currIntents = vioCount_(current, function(x){return x.intent;});
  const currRubrics = vioCount_(current, function(x){return x.rubric || 'Без рубрики';});
  const concreteTopics = vioConcreteTopics_(current);
  const topicDetails = vioTopicDetails_(current);

  const names = {};
  Object.keys(currTopics).forEach(function(k){names[k]=true;});
  Object.keys(prevTopics).forEach(function(k){names[k]=true;});

  const topics = Object.keys(names).map(function(name){
    const count = currTopics[name] || 0;
    const prev = prevTopics[name] || 0;
    const share = current.length ? count/current.length*100 : 0;
    const prevShare = previous.length ? prev/previous.length*100 : 0;
    return {name:name,count:count,previousCount:prev,share:vioRound_(share,1),previousShare:vioRound_(prevShare,1),deltaPp:vioRound_(share-prevShare,1)};
  }).sort(function(a,b){return b.count-a.count || b.deltaPp-a.deltaPp;});

  const rising = topics.filter(function(x){return x.name!=='Другие вопросы' && x.count>=10 && x.deltaPp>0;})
    .sort(function(a,b){return b.deltaPp-a.deltaPp || b.count-a.count;}).slice(0,10);

  const intents = Object.keys(currIntents).map(function(name){
    const count=currIntents[name];
    return {name:name,count:count,share:current.length?vioRound_(count/current.length*100,1):0};
  }).sort(function(a,b){return b.count-a.count;}).slice(0,10);

  const rubrics = Object.keys(currRubrics).map(function(name){
    const count=currRubrics[name];
    return {name:name,count:count,share:current.length?vioRound_(count/current.length*100,1):0};
  }).sort(function(a,b){return b.count-a.count;}).slice(0,12);

  const currentDays = vioCoverageDays_(current);
  const previousDays = vioCoverageDays_(previous);
  const currentPace = currentDays ? current.length/currentDays : 0;
  const previousPace = previousDays ? previous.length/previousDays : 0;

  return {
    currentTotal: current.length,
    previousTotal: previous.length,
    currentDays: currentDays,
    previousDays: previousDays,
    currentPace: vioRound_(currentPace,1),
    previousPace: vioRound_(previousPace,1),
    paceChangePct: previousPace ? vioRound_((currentPace/previousPace-1)*100,1) : null,
    topTopics: topics.slice(0,12),
    risingTopics: rising,
    intents: intents,
    rubrics: rubrics,
    concreteTopics: concreteTopics.slice(0,18),
    topicDetails: topicDetails
  };
}

function vioConcreteTopics_(items) {
  const map = {};

  items.forEach(function(x) {
    const action = x.action || 'Разобрать';
    const object = x.object || '';
    if (!object || object === 'Без конкретного предмета') return;

    const key = action + ' → ' + object;
    if (!map[key]) {
      map[key] = {
        name: key,
        action: action,
        object: object,
        topic: x.topic || 'Другие вопросы',
        count: 0,
        intents: {},
        examples: []
      };
    }

    map[key].count++;
    map[key].intents[x.intent] = (map[key].intents[x.intent] || 0) + 1;

    const example = String(x.title || '').trim();
    if (example && map[key].examples.indexOf(example) < 0 && map[key].examples.length < 4) {
      map[key].examples.push(example);
    }
  });

  return Object.keys(map)
    .map(function(key) {
      const item = map[key];
      const topIntent = Object.keys(item.intents)
        .map(function(name){return {name:name,count:item.intents[name]};})
        .sort(function(a,b){return b.count-a.count;})[0] || {name:'',count:0};

      return {
        name: item.name,
        action: item.action,
        object: item.object,
        topic: item.topic,
        count: item.count,
        topIntent: topIntent.name,
        examples: item.examples.slice(0,3)
      };
    })
    .sort(function(a,b){return b.count-a.count || a.name.localeCompare(b.name);});
}

function vioTopicDetails_(items) {
  const byTopic = {};

  items.forEach(function(x) {
    const topic = x.topic || 'Другие вопросы';
    if (!byTopic[topic]) byTopic[topic] = {name:topic,count:0,specifics:{}};
    byTopic[topic].count++;

    const object = x.object || '';
    if (!object || object === 'Без конкретного предмета') return;

    const label = (x.action || 'Разобрать') + ' → ' + object;
    if (!byTopic[topic].specifics[label]) {
      byTopic[topic].specifics[label] = {name:label,count:0,intents:{}};
    }
    const row = byTopic[topic].specifics[label];
    row.count++;
    row.intents[x.intent] = (row.intents[x.intent] || 0) + 1;
  });

  return Object.keys(byTopic)
    .map(function(topic) {
      const item = byTopic[topic];
      const specifics = Object.keys(item.specifics)
        .map(function(label) {
          const row = item.specifics[label];
          const topIntent = Object.keys(row.intents)
            .map(function(name){return {name:name,count:row.intents[name]};})
            .sort(function(a,b){return b.count-a.count;})[0] || {name:'',count:0};
          return {name:label,count:row.count,topIntent:topIntent.name};
        })
        .sort(function(a,b){return b.count-a.count || a.name.localeCompare(b.name);})
        .slice(0,8);

      return {name:item.name,count:item.count,specifics:specifics};
    })
    .sort(function(a,b){return b.count-a.count;})
    .slice(0,12);
}

function vioAction_(direction, title, question) {
  const s = vioNorm_([title,question].join(' '));

  if (direction === 'ГФ') {
    if (/списан|списать|списание|прекращени.*признан/.test(s)) return 'Списание';
    if (/принять к учет|принять к учёт|принятие к учет|оприход|постановк.*на учет|поставить на учет/.test(s)) return 'Принятие к учёту';
    if (/передач|передать|безвозмездн.*польз|оперативн.*управлен/.test(s)) return 'Передача';
    if (/инвентаризац|инвентарн.*комисс/.test(s)) return 'Инвентаризация';
    if (/возврат|вернуть|возмещен/.test(s)) return 'Возврат / возмещение';
    if (/амортизац|срок полезн.*использ/.test(s)) return 'Амортизация';
    if (/ремонт|модернизац|реконструк/.test(s)) return 'Ремонт / модернизация';
    if (/начислен|рассчит|расчет|расчёт/.test(s)) return 'Начисление / расчёт';
    if (/оформ|документ|акт|накладн|приказ/.test(s)) return 'Оформление документов';
    if (/проводк|отразить.*учет|отразить.*учёт|учитывать|учет|учёт/.test(s)) return 'Учёт / проводки';
    return 'Разобрать';
  }

  if (/нмцк|обоснован.*цен|рассчит.*цен/.test(s)) return 'Расчёт НМЦК';
  if (/отклон|допуск|оценк.*заяв/.test(s)) return 'Заявка: допуск / отклонение';
  if (/описан.*объект|технич.*задан|техническ.*задан|характеристик/.test(s)) return 'Описание объекта / ТЗ';
  if (/национальн.*режим|нацрежим|1875|происхожд/.test(s)) return 'Нацрежим';
  if (/изменени.*контракт|допсоглаш|изменить.*контракт/.test(s)) return 'Изменение контракта';
  if (/расторж|односторонн.*отказ/.test(s)) return 'Расторжение';
  if (/приемк|приёмк|экспертиз/.test(s)) return 'Приёмка / экспертиза';
  if (/оплат|неустойк|штраф|пени|пеня/.test(s)) return 'Оплата / неустойка';
  if (/еис|реестр.*контракт|реестр.*договор/.test(s)) return 'ЕИС / реестр';
  if (/единственн.*постав|едпостав|пункт 4|пункт 5/.test(s)) return 'Единственный поставщик';
  if (/закуп|аукцион|котировк|конкурс/.test(s)) return 'Проведение закупки';
  if (/контракт|договор/.test(s)) return 'Контракт / договор';
  return 'Разобрать';
}

function vioObject_(direction, rubric, title, question) {
  const s = vioNorm_([rubric,title,question].join(' '));

  const form = (s.match(/(?:ф\.?\s*)?05\d{5,6}/) || [])[0];
  if (form) return 'форма ' + form.replace(/^ф\.?\s*/,'').trim();

  if (direction === 'ГФ') {
    if (/картридж|принтер|мфу|оргтех|компьютер|ноутбук|монитор|сканер|сервер/.test(s)) return 'компьютеры / оргтехника / картриджи';
    if (/автомоб|служебн.*машин|транспорт|шины|гсм|бензин|дизел|топлив/.test(s)) return 'автомобили / транспорт / ГСМ';
    if (/спецодеж|сиз|средств.*индивидуальн.*защит/.test(s)) return 'спецодежда / СИЗ';
    if (/бсо|бланк.*строг|бланк/.test(s)) return 'БСО / бланки';
    if (/мебел|стол|стул|шкаф|кровать|тумб/.test(s)) return 'мебель';
    if (/аптечк|медицинск.*оборуд|медиздел|реабилитац/.test(s)) return 'медицинское имущество';
    if (/здани|помещен|сооружен|недвиж/.test(s)) return 'здания / помещения / недвижимость';
    if (/земел|земля|участок/.test(s)) return 'земельные участки';
    if (/продукт.*питан|питани|столов|готов.*продукц/.test(s)) return 'продукты / питание';
    if (/двер|окн|стройматериал|линолеум|ламинат|краск|кабель|сантех/.test(s)) return 'стройматериалы / элементы ремонта';
    if (/основн.*средств|\bос\b|счет 101|счете 101/.test(s)) return 'основные средства';
    if (/материал.*запас|матзапас|счет 105|счете 105/.test(s)) return 'материальные запасы';
    if (/дебитор|кредитор|задолж/.test(s)) return 'дебиторская / кредиторская задолженность';
    if (/аванс/.test(s)) return 'авансы';
    if (/аренд/.test(s)) return 'аренда';
    if (/субсид|грант|госзадан/.test(s)) return 'субсидии / гранты / госзадание';
    if (/зарплат|преми|средн.*заработ|оплат.*труд/.test(s)) return 'зарплата / премии';
    if (/отпуск/.test(s)) return 'отпускные';
    if (/больнич|пособ/.test(s)) return 'больничные / пособия';
    if (/ндфл|ндс|страхов.*взнос|налог/.test(s)) return 'налоги / взносы';
    return 'Без конкретного предмета';
  }

  if (/программ|лицензи|сайт|информационн.*систем|по\b/.test(s)) return 'ПО / лицензии / ИТ';
  if (/лекар|медиздел|медицинск.*оборуд|медицинск.*отход/.test(s)) return 'лекарства / медизделия';
  if (/строител|капремонт|ремонт|смет|проектн.*работ|демонтаж|снос|благоустрой/.test(s)) return 'строительство / ремонт';
  if (/охран|чоо|ктс|тревожн/.test(s)) return 'охранные услуги';
  if (/гсм|топлив|бензин|дизел/.test(s)) return 'ГСМ / топливо';
  if (/автомоб|транспорт|перевоз/.test(s)) return 'транспорт';
  if (/картридж|принтер|мфу|компьютер|сервер|оборудован|техник/.test(s)) return 'оборудование / техника';
  if (/питан|столов|продукт.*питан/.test(s)) return 'питание';
  if (/образоват|обучен|повышен.*квалификац/.test(s)) return 'образовательные услуги';
  if (/электроэнерг|теплоснабж|водоснабж|коммунальн/.test(s)) return 'коммунальные услуги';
  if (/связ|телеком|интернет/.test(s)) return 'услуги связи';
  if (/утилизац|отход|обезвреж/.test(s)) return 'утилизация / отходы';
  if (/заявк|участник/.test(s)) return 'заявки участников';
  if (/независим.*гарант|банковск.*гарант/.test(s)) return 'независимая гарантия';
  if (/контракт|договор/.test(s)) return 'контракт / договор';
  if (/товар/.test(s)) return 'товар';
  if (/работ/.test(s)) return 'работы';
  if (/услуг/.test(s)) return 'услуги';
  return 'Без конкретного предмета';
}

function vioCount_(items, fn) {
  const out = {};
  items.forEach(function(x){const key=fn(x)||'Другие вопросы';out[key]=(out[key]||0)+1;});
  return out;
}

function vioDirection_(url, rubric, title, question) {
  const u = String(url || '');
  if (/^\/question\//i.test(u)) return 'ГЗ';
  if (/^\/qa\//i.test(u)) return 'ГФ';
  const s = vioNorm_([rubric,title,question].join(' '));
  if (/(44-фз|223-фз|госзакуп|закупк|нмцк|еис|ктру|окпд|контракт|поставщик)/.test(s)) return 'ГЗ';
  if (/(бухгалтер|учет|косгу|квр|кбк|зарплат|ндфл|субсид|имущество|проводк|отчетност)/.test(s)) return 'ГФ';
  return '';
}

function vioTopic_(direction, rubric, title, question) {
  const s = vioNorm_([rubric,title,question].join(' '));
  if (direction === 'ГЗ') {
    if (/(1875|национальн.*режим|российск.*происхожд|реестр.*пром|рпп|ст-1|спик|гисп)/.test(s)) return 'Нацрежим и российское происхождение';
    if (/(223-фз|223 фз|закупк.*223)/.test(s)) return '223-ФЗ';
    if (/(изменени.*контракт|допсоглаш|дополнительн.*соглаш|изменить.*контракт|корректиров.*контракт)/.test(s)) return 'Изменение условий контракта';
    if (/(исполнени.*контракт|приемк|оплат|неустойк|пени|пеня|штраф|гарантийн.*обяз)/.test(s)) return 'Исполнение, приемка, оплата, неустойка';
    if (/(нмцк|обоснован.*цен|коммерческ.*предлож|начальн.*цен|цена.*контракт)/.test(s)) return 'НМЦК и цена';
    if (/(еис|реестр.*контракт|реестр.*договор|электронн.*прием|структурирован)/.test(s)) return 'ЕИС, реестры и электронные документы';
    if (/(заявк|участник|отклон|оценк.*заяв|допуск)/.test(s)) return 'Заявки и требования к участникам';
    if (/(единственн.*постав|едпостав|ст\.?\s*93|стать[яи]\s*93)/.test(s)) return 'Единственный поставщик';
    if (/(строител|ремонт|капремонт|смет|проектн.*работ|снос|демонтаж|благоустрой)/.test(s)) return 'Строительство и ремонт';
    if (/(расторжен|односторонн.*отказ|прекращен.*контракт)/.test(s)) return 'Расторжение контракта';
    if (/(окпд|ктру|код.*товар|классификатор)/.test(s)) return 'ОКПД2 и КТРУ';
    if (/(обеспечен.*контракт|банковск.*гарант|независим.*гарант)/.test(s)) return 'Обеспечение и гарантии';
    if (/(отчет|мсп|смп|объем.*закуп)/.test(s)) return 'Отчетность и объем закупок';
    if (/(лекар|медиздел|медицинск)/.test(s)) return 'Лекарства и медизделия';
    if (/(заключени.*контракт|проект.*контракт)/.test(s)) return 'Заключение контракта';
    if (/(описан.*объект|технич.*задан|техническ.*задан|характеристик.*товар|товарн.*знак)/.test(s)) return 'Описание объекта закупки и ТЗ';
    if (/(план-график|планирован.*закуп)/.test(s)) return 'Планирование и план-график';
    if (/(аукцион|котировк|конкурс)/.test(s)) return 'Способы закупки и процедуры';
    if (/(гособорон|оборонн.*заказ|контракт.*гоз|по гоз)/.test(s)) return 'ГОЗ';
    if (/(охранн.*услуг|частн.*охран|чоо)/.test(s)) return 'Охранные услуги';
    if (/нарушени.*44-фз/.test(s)) return 'Контроль и нарушения 44-ФЗ';
    return 'Другие вопросы';
  }
  if (/(основн.*средств|материал.*запас|учет имущества|автомоб|оборудован|мебел|инвентар|списан.*имуществ|нефинансов|оци|105 счет|101 счет|баланс.*имуществ|аптечк|картридж|гсм)/.test(s)) return 'Имущество: ОС, МЗ, списание, инвентаризация';
  if (/(косгу|квр|кбк|бюджетн.*классификац)/.test(s)) return 'КВР, КОСГУ, КБК';
  if (/(проводк|счет 20|счет 30|счет 10|учет доход|учет расход|бухгалтерск.*учет|оприход|дебет|кредит|отразить.*учет)/.test(s)) return 'Проводки, счета, доходы и расходы';
  if (/(зарплат|преми|средн.*заработ|мрот|оплат.*труд|доплат|надбав|заработн)/.test(s)) return 'Зарплата и выплаты';
  if (/(кадр|увольнен|прием.*работ|совмещен|совместител|рабоч.*врем|трудов)/.test(s)) return 'Кадры и трудовые отношения';
  if (/(отчетност|отчет|пояснительн.*записк|баланс|форма 05|электронн.*бюджет|первичн.*документ|первичк)/.test(s)) return 'Отчетность и первичные документы';
  if (/(ндфл|ндс|страхов.*взнос|налог|травматизм)/.test(s)) return 'Налоги и взносы';
  if (/(субсид|финансирован|грант|целев.*средств|софинанс)/.test(s)) return 'Субсидии и финансирование';
  if (/(отпуск|больнич|пособ|декрет|компенсац.*работник|командиров)/.test(s)) return 'Отпуска, пособия, командировки, компенсации';
  if (/(госзаказ|госконтракт|закупк|контракт)/.test(s)) return 'Закупки и госконтракты';
  if (/(внутренн.*контрол|аудит|провер|ревиз)/.test(s)) return 'Контроль, аудит и проверки';
  if (/(аренд|пользован.*имуществ|безвозмездн.*польз)/.test(s)) return 'Аренда и пользование имуществом';
  if (/(план фхд|пфхд|финансово-хозяйствен.*деятельн)/.test(s)) return 'План ФХД и бюджетное планирование';
  if (/(учетн.*политик|централизац|обособленн.*подраздел|резерв.*предстоящ)/.test(s)) return 'Организация бухгалтерии и учетная политика';
  return 'Другие вопросы';
}

function vioIntent_(direction, title, question) {
  const s = vioNorm_([title,question].join(' '));
  if (/(как исправ|исправлен|ошибк|разночтен|корректир|уточнен|восстанов|что делать|как поступ|не сход|не совпад|возврат|вернуть)/.test(s)) return 'Исправить ошибку / решить проблему';
  if (/(можно ли|вправе ли|правомер|допустим|обязан|обязательно|нужно ли|надо ли|требуется ли|должен ли|имеет ли право|разрешено ли)/.test(s)) return 'Проверить: можно ли / обязательно ли';
  if (/(какие документ|какой документ|перечень документ|что прилож|чем подтверд|подтверждающ|какие требован|что указать|как оформ|оформлен|как заполн|заполнен|как состав|составлен|какую форму|какая форма)/.test(s)) return 'Оформить документы / подтвердить';
  if (/(косгу|квр|кбк|какой счет|на каком счет|счет 10|счет 20|счет 30|окпд|ктру|какой код|какую стать|куда отнест|к чему отнест|как классифиц)/.test(s)) return 'Выбрать код / счет / классификацию';
  if (/(как рассчитать|расчет|рассчитать|определить цену|нмцк|размер|сколько|процент|стоимост|сумма|сумму)/.test(s)) return 'Рассчитать сумму / цену / показатель';
  if (/(срок|когда|дата|до какого|с какого момента|в течение|период)/.test(s)) return 'Определить срок / дату';
  if (/(как изменить|изменени|допсоглаш|дополнительн.*соглаш|расторг|прекрат|односторонн.*отказ|продлить|перенести)/.test(s)) return 'Изменить / прекратить / продлить';
  if (direction==='ГФ' && /(проводк|отразить в бух|отражен.*учет|учесть|учитывать|оприход|списан|начисл|дебет|кредит)/.test(s)) return 'Отразить в учете / сделать проводки';
  if (/(отчет|отчетност|декларац|пояснительн|сведения в еис|реестр)/.test(s)) return 'Сдать отчет / заполнить сведения';
  if (/(как закуп|как провести|как заключ|порядок|алгоритм|как принять|как оплат|как спис|как передат|как выдать|как вести|как учитывать)/.test(s)) return 'Понять порядок действий';
  return 'Разобраться в конкретной ситуации';
}

function vioNorm_(v){return String(v||'').toLowerCase().replace(/ё/g,'е').replace(/[«»"“”]/g,' ').replace(/\s+/g,' ').trim();}
function vioDate_(v){const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[1]+'-'+m[2]+'-'+m[3]:'';}
function vioMonthLabel_(v){const m=String(v||'').match(/^(\d{4})-(\d{2})$/);if(!m)return v||'';const a=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];return a[Number(m[2])-1]+' '+m[1];}
function vioCoverageDays_(rows){if(!rows.length)return 0;const d=rows.map(function(x){return x.date;}).sort();return Math.max(1,Math.round((new Date(d[d.length-1]+'T00:00:00Z')-new Date(d[0]+'T00:00:00Z'))/86400000)+1);}
function vioRound_(v,d){const p=Math.pow(10,d||0);return Math.round((Number(v)||0)*p)/p;}
