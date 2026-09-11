(()=>{
  let pairPage = 1;
  const PAGE = 80;

  const ratio = (a,b) =>
    (+a > 0 && +b > 0) ? (+b / +a) : null;

  const logGap = (a,b) =>
    Math.abs(
      Math.log(
        Math.max(+a || 1,1) /
        Math.max(+b || 1,1)
      )
    );

  /*
    Критерии качественной пары:

    0 — хорошая пара:
    - тот же сайт
    - тот же интент
    - та же тема
    - похожий трафик
    - есть минимум 2 демо

    1 — допустимая:
    - тот же сайт
    - тот же интент
    - та же тема
    - есть демо
  */

  function pairLevel(a,b){

    if(!b) return 99;

    const sameIntent =
      (a.intent || '') === (b.intent || '');

    const sameTopic =
      (a.topic || '') === (b.topic || '');

    const r = ratio(a.visits,b.visits);

    const closeTraffic =
      r !== null &&
      r >= 0.5 &&
      r <= 2;

    const demos =
      +b.demos || 0;


    if(
      sameIntent &&
      sameTopic &&
      closeTraffic &&
      demos >= 2
    ){
      return 0;
    }


    if(
      sameIntent &&
      sameTopic &&
      demos > 0 &&
      closeTraffic
    ){
      return 1;
    }


    return 99;
  }


  function pairReason(a,b){

    if(!b){
      return 'Нет качественной статьи для сравнения';
    }


    if(pairLevel(a,b)===0){
      return 'Та же тема, похожий трафик, есть успешный пример';
    }


    if(pairLevel(a,b)===1){
      return 'Та же тема и интент, есть пример с демо';
    }


    return 'Не подходит для корректного сравнения';
  }



  function comparisonQuality(a,b){

    if(!b){
      return 'Нет пары';
    }


    if(pairLevel(a,b)===0){
      return 'Высокое';
    }


    if(pairLevel(a,b)===1){
      return 'Среднее';
    }


    return 'Нет';
  }



  function choosePair(article,candidates){

    const good =
      candidates.filter(
        x => pairLevel(article,x) < 99
      );


    if(!good.length){
      return null;
    }


    return [...good].sort(
      (a,b)=>

        pairLevel(article,a)
        -
        pairLevel(article,b)

        ||

        logGap(article.visits,a.visits)
        -
        logGap(article.visits,b.visits)

        ||

        (+b.demos||0)
        -
        (+a.demos||0)

    )[0] || null;

  }



  function noPairReason(article,candidates){

    if(!candidates.length){

      return 'Нет других статей внутри этого интента';

    }


    const sameTopic =
      candidates.filter(
        x =>
        (x.topic||'') ===
        (article.topic||'')
      );


    if(!sameTopic.length){

      return 'Нет статьи с такой же темой';

    }


    const withDemo =
      sameTopic.filter(
        x =>
        (+x.demos||0)>0
      );


    if(!withDemo.length){

      return 'Есть похожие статьи, но нет успешного примера с демо';

    }


    return 'Есть кандидаты, но они не проходят критерии сравнения';

  }
    function buildPairs(site, articles){

    const byIntent = new Map();


    articles.forEach(article=>{

      const key =
        article.intent || 'Не определён';


      if(!byIntent.has(key)){
        byIntent.set(key,[]);
      }


      byIntent
        .get(key)
        .push(article);

    });



    const pairs = [];
    const noPairs = [];

    const used = {};



    articles.forEach(article=>{


      const candidates =
        (byIntent.get(
          article.intent || 'Не определён'
        ) || [])
        .filter(
          x =>
          String(x.id)!==
          String(article.id)
          &&
          (+x.visits||0)>0
        );



      const pair =
        choosePair(
          article,
          candidates
        );



      if(!pair){

        noPairs.push({

          ...article,

          no_pair_reason:
            noPairReason(
              article,
              candidates
            )

        });


        return;

      }



      used[String(pair.id)] =
        (used[String(pair.id)] || 0)
        + 1;



      pairs.push({

        ...article,


        pair_id:
          String(pair.id),


        pair_title:
          pair.title,


        pair_url:
          pair.url,


        pair_topic:
          pair.topic,


        pair_visits:
          +pair.visits || 0,


        pair_clicks:
          +pair.clicks || 0,


        pair_demos:
          +pair.demos || 0,


        pair_demo_1000:
          +pair.demo_1000 || 0,


        comparison_quality:
          comparisonQuality(
            article,
            pair
          ),


        comparison_reason:
          pairReason(
            article,
            pair
          )

      });


    });



    pairs.forEach(row=>{

      row.pair_used_by =
        used[String(row.pair_id)] || 0;

    });



    return {

      pairs,

      noPairs

    };

  }




  const budgetnikResult =
    buildPairs(
      'Бюджетник',
      DATA.articles['Бюджетник'] || []
    );


  const goszakazResult =
    buildPairs(
      'ПроГосзаказ',
      DATA.articles['ПроГосзаказ'] || []
    );



  DATA.pairs =
  {

    'Бюджетник':
      budgetnikResult.pairs,


    'ПроГосзаказ':
      goszakazResult.pairs

  };



  DATA.noPairs =
  {

    'Бюджетник':
      budgetnikResult.noPairs,


    'ПроГосзаказ':
      goszakazResult.noPairs

  };



  function currentNoPairs(){

    return DATA.noPairs[state.site] || [];

  }



  function currentPairs(){

    return DATA.pairs[state.site] || [];

  }
  function renderPairs(){

  const list =
    document.getElementById('pairList');


  const rows =
    currentPairs();


  const total =
    rows.length;


  if(!total){

    list.innerHTML =
      '<div class="empty">Нет качественных сопоставимых пар.</div>';

    return;

  }



  const high =
    rows.filter(
      x =>
      x.comparison_quality === 'Высокое'
    ).length;


  const medium =
    rows.filter(
      x =>
      x.comparison_quality === 'Среднее'
    ).length;



  const used =
    rows.filter(
      x =>
      x.pair_used_by > 1
    ).length;



  let html = `

  <div class="summary-strip">

    <div class="summary-tile">
      <small>Качественные пары</small>
      <b>${n(total)}</b>
    </div>


    <div class="summary-tile">
      <small>Высокое качество</small>
      <b>${n(high)}</b>
    </div>


    <div class="summary-tile">
      <small>Среднее качество</small>
      <b>${n(medium)}</b>
    </div>


    <div class="summary-tile">
      <small>Статьи без пары</small>
      <b>${n(currentNoPairs().length)}</b>
    </div>

  </div>


  <div class="table-wrap">

  <table>

  <thead>

  <tr>

    <th>Статья</th>

    <th>Статья для сравнения</th>

    <th>Почему сравниваем</th>

    <th>Качество</th>

    <th>Демо</th>

  </tr>

  </thead>


  <tbody>
  `;



  rows.forEach(row=>{


    html += `

    <tr>


    <td>

      <a
      class="title-link"
      href="${esc(row.url)}"
      target="_blank">

      ${esc(row.title)}

      </a>


      <div class="small-note">

      ${esc(row.intent)}
      ·
      ${esc(row.topic)}

      </div>

    </td>



    <td>

      <a
      class="title-link"
      href="${esc(row.pair_url)}"
      target="_blank">

      ${esc(row.pair_title)}

      </a>


      <div class="small-note">

      ${n(row.pair_visits)}
      визитов /
      ${n(row.pair_demos)}
      демо

      </div>

    </td>



    <td>

      ${esc(row.comparison_reason)}

    </td>



    <td>

      <span class="chip neutral">

      ${esc(row.comparison_quality)}

      </span>

    </td>



    <td>

      ${d(row.demo_1000)}
      /
      ${d(row.pair_demo_1000)}

    </td>



    </tr>

    `;


  });



  html += `

  </tbody>

  </table>

  </div>

  `;


  list.innerHTML = html;

}




function renderNoPairs(){


  const list =
    document.getElementById('noPairList');


  const rows =
    currentNoPairs();



  if(!rows.length){

    list.innerHTML =
    '<div class="empty">Все статьи получили качественную пару.</div>';

    return;

  }



  let html = `


  <div class="summary-strip">


    <div class="summary-tile">

      <small>Без сопоставимой пары</small>

      <b>${n(rows.length)}</b>

    </div>


  </div>



  <div class="table-wrap">


  <table>


  <thead>

  <tr>

    <th>Статья</th>

    <th>Интент</th>

    <th>Тема</th>

    <th>Почему нет пары</th>

  </tr>


  </thead>


  <tbody>

  `;



  rows.forEach(row=>{


    html += `


    <tr>


      <td>

      <a
      class="title-link"
      href="${esc(row.url)}"
      target="_blank">

      ${esc(row.title)}

      </a>

      </td>



      <td>

      ${esc(row.intent)}

      </td>



      <td>

      ${esc(row.topic)}

      </td>



      <td>

      ${esc(row.no_pair_reason)}

      </td>


    </tr>


    `;


  });



  html += `

  </tbody>

  </table>

  </div>

  `;



  list.innerHTML = html;

}



renderPairs();

if(
 document.getElementById('noPairList')
){

 renderNoPairs();

}


})();
