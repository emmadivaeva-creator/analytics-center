/** Aggregated VIO demand trends. Raw questions are never returned to the public UI. */
const VIO_TRENDS_SOURCE_ID_ = '1ENnwfKY_fqyr4-81pjUDY3gsfcu_vf9zVnuifiR_5XU';

function getVioTrendsUi(force) {
  requireDashboardOwner_();
  const cache = CacheService.getScriptCache();
  const cacheKey = 'vio-trends-v7';
  if (!Number(force)) {
    try {
      const cached = cache.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {}
  }

  const book = SpreadsheetApp.openById(VIO_TRENDS_SOURCE_ID_);
  const byId = {};

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
      if (!byId[id] || modified >= byId[id].modified) byId[id] = item;
    }
  });

  const items = Object.keys(byId).map(function(id) { return byId[id]; });
  const months = Array.from(new Set(items.map(function(x){return x.month;}))).sort();
  const currentMonth = months.length ? months[months.length - 1] : '';
  const previousMonth = months.length > 1 ? months[months.length - 2] : '';

  const result = {
    meta: {
      sourceTitle: book.getName(),
      readAt: new Date().toISOString(),
      currentMonth: currentMonth,
      previousMonth: previousMonth,
      currentLabel: vioMonthLabel_(currentMonth),
      previousLabel: vioMonthLabel_(previousMonth),
      totalRows: items.length
    },
    groups: {
      'ГЗ': vioGroup_(items, 'ГЗ', currentMonth, previousMonth),
      'ГФ': vioGroup_(items, 'ГФ', currentMonth, previousMonth)
    }
  };

  try {
    const json = JSON.stringify(result);
    if (json.length < 95000) cache.put(cacheKey, json, 600);
  } catch (e) {}
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
