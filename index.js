const extensionName = "bazi-gacha-array";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

if (typeof marked === 'undefined') {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
    document.head.appendChild(script);
}

let pcaData = {};
const SPECIAL_PROVS = ["香港特别行政区", "澳门特别行政区", "台湾"];
const OTHER_KEY = "海外及其他地区";

// ================== 前端 64卦 硬核映射表 ==================
const hexagramMap = {
  "111111":"乾为天", "000000":"坤为地", "100010":"水雷屯", "010001":"山水蒙", "111010":"水天需", "010111":"天水讼", "010000":"地水师", "000010":"水地比", "111011":"风天小畜", "110111":"天泽履", "111000":"地天泰", "000111":"天地否", "101111":"天火同人", "111101":"火天大有", "001000":"地山谦", "000100":"雷地豫", "100110":"泽雷随", "011001":"山风蛊", "110000":"地泽临", "000011":"风地观", "100101":"火雷噬嗑", "101001":"山火贲", "000001":"山地剥", "100000":"地雷复", "100111":"天雷无妄", "111001":"山天大畜", "100001":"山雷颐", "011110":"泽风大过", "010010":"坎为水", "101101":"离为火", "001110":"泽山咸", "011100":"雷风恒", "001111":"天山遁", "111100":"雷天大壮", "000101":"火地晋", "101000":"地火明夷", "101011":"风火家人", "110101":"火泽睽", "001010":"水山蹇", "010100":"雷水解", "110001":"山泽损", "100011":"风雷益", "111110":"泽天夬", "011111":"天风姤", "000110":"泽地萃", "011000":"地风升", "010110":"泽水困", "011010":"水风井", "101110":"泽火革", "011101":"火风鼎", "100100":"震为雷", "001001":"艮为山", "001011":"风山渐", "110100":"雷泽归妹", "101100":"雷火丰", "001101":"火山旅", "011011":"巽为风", "110110":"兑为泽", "010011":"风水涣", "110010":"水泽节", "110011":"风泽中孚", "001100":"雷山小过", "101010":"水火既济", "010101":"火水未济"
};

// ================== 本地游戏知识库 ==================
const GameDatabase = [
  {
    name: "恋与深空", keywords: ["恋与深空", "深空"],
    desc: "一款近未来幻想的3D乙女恋爱手游，提供高沉浸互动体验。主控为女性猎人小姐。五星卡分为日卡和月卡，日卡为两张一套，必须抽齐一套才有用，满150抽会送一张用户可自选两张中任意一张；月卡就是单张，和其他游戏相同。",
    characters: [
      { name: "沈星回", info: "生日：10月16日，EVOL属性：光" },
      { name: "黎深", info: "生日：9月5日，EVOL属性：冰" },
      { name: "祁煜", info: "生日：3月6日，EVOL属性：火" },
      { name: "秦彻", info: "生日：4月18日，EVOL属性：能量操控" },
      { name: "夏以昼", info: "生日：6月13日，EVOL属性：引力" }
    ]
  },
  {
    name: "世界之外", keywords: ["世界之外", "世外"],
    desc: "网易开发的无限流言情手游。女性玩家扮演不同角色于副本中完成任务，体验超越现实的甜蜜爱恋。",
    characters: [
      { name: "顾时夜", info: "生日：11月22日" },
      { name: "易遇", info: "生日：12月31日" },
      { name: "柏源", info: "生日：4月15日" },
      { name: "夏萧因", info: "生日：9月10日" }
    ]
  },
  {
    name: "无限暖暖", keywords: ["无限暖暖", "暖暖"],
    desc: "暖暖系列第五代作品，一款多平台开放世界换装冒险游戏，玩家将与大喵在奇迹大陆探索解谜。注：本游戏不抽卡，抽四星阁/五星阁。为服装部件，四星阁5抽保底一件，五星阁20抽保底一件，整套多为8-11件，满进化需抽2套。本游戏不会歪常驻服装。",
    characters: [
      { name: "苏暖暖", info: "生日：12月6日" },
      { name: "暖暖", info: "生日：12月6日" }
    ]
  }
];

function extractGameContext(wishText) {
  let injectedContext = "";
  GameDatabase.forEach(game => {
    let isGameMentioned = game.keywords.some(kw => wishText.includes(kw));
    let mentionedChars = game.characters.filter(c => wishText.includes(c.name));
    if (isGameMentioned || mentionedChars.length > 0) {
      injectedContext += `\n【系统注入补充资料：${game.name}】\n游戏简介：${game.desc}\n相关角色信息：\n`;
      let printedInfos = new Set();
      let targetChars = (isGameMentioned && mentionedChars.length === 0) ? game.characters : mentionedChars;
      targetChars.forEach(c => {
        if (!printedInfos.has(c.info)) {
          injectedContext += `- ${c.name}: ${c.info}\n`;
          printedInfos.add(c.info);
        }
      });
    }
  });
  return injectedContext;
}

// ================== 六爻起卦及视觉渲染 ==================
function castLiuyao() {
  const wish = $('#bazi_wish').val().trim();
  if (!wish) {
    toastr.warning("请先在上方填写您的愿望，再进行起卦！");
    $('#bazi_wish').focus();
    return;
  }

  $('#bazi_hexagram-lines-box').empty();
  $('#bazi_hexagram-display').show();

  const yaoNames = ["初爻", "二爻", "三爻", "四爻", "五爻", "上爻"];
  let resultsTextForAI = "";
  let visualHtml = ""; 
  let originalBits = ""; // 本卦二进制
  let changedBits = "";  // 变卦二进制

  for (let i = 0; i < 6; i++) {
    const toss = () => (Math.random() < 0.5 ? 2 : 3); 
    const sum = toss() + toss() + toss();
    
    let symbol = ""; let mark = ""; let typeName = "";
    
    if (sum === 6) { 
        symbol = "▅▅　▅▅"; mark = "× 交"; typeName = "老阴"; 
        originalBits += "0"; changedBits += "1";
    } else if (sum === 7) { 
        symbol = "▅▅▅▅▅"; mark = "′ 单"; typeName = "少阳"; 
        originalBits += "1"; changedBits += "1";
    } else if (sum === 8) { 
        symbol = "▅▅　▅▅"; mark = "″ 拆"; typeName = "少阴"; 
        originalBits += "0"; changedBits += "0";
    } else if (sum === 9) { 
        symbol = "▅▅▅▅▅"; mark = "○ 重"; typeName = "老阳"; 
        originalBits += "1"; changedBits += "0";
    }

    resultsTextForAI += `${yaoNames[i]}: ${typeName}(数字${sum}) -> 符号[${symbol}]\n`;
    
    const lineHtml = `
      <div class="hexagram-line">
        <span class="yao-name">${yaoNames[i]}</span>
        <span class="yao-symbol">${symbol}</span>
        <span class="yao-mark">${mark}</span>
        <span class="yao-type">${typeName}</span>
      </div>`;
    visualHtml = lineHtml + visualHtml; 
  }

  const benGua = hexagramMap[originalBits] || "未知卦象";
  const bianGua = hexagramMap[changedBits] || "未知卦象";

  $('#bazi_hexagram-title').text(`本卦：${benGua}  |  变卦：${bianGua}`);
  $('#bazi_hexagram-lines-box').html(visualHtml);
  
  $('#bazi_liuyaoResultData').val(`【前端推算结果】本卦：${benGua}，变卦：${bianGua}\n【抛掷明细(初爻至上爻)】\n${resultsTextForAI}`);
  
  $('#bazi_castBtn').text("☯️ 卦象已成 (点击可重新起卦)").css("background-color", "#8b0000");
}

// ================== 系统初始化 ==================
jQuery(async () => {
    const uiHtml = await $.get(`${extensionFolderPath}/bazi_ui.html`);
    $("#extensions_settings").append(uiHtml);

    const modalHtml = await $.get(`${extensionFolderPath}/bazi_modal.html`);
    $("body").append(modalHtml);

    $("#bazi_open_modal_btn").on("click", () => {
        $("#bazi_modal_container").css('display', 'flex').hide().fadeIn('fast');
    });
    $("#bazi_modal_close").on("click", () => $("#bazi_modal_container").fadeOut('fast'));
    $("#bazi_modal_container").on("click", function(e) {
        if (e.target === this) $(this).fadeOut('fast');
    });

    const savedUseStApi = localStorage.getItem('bazi_use_st_api');
    if (savedUseStApi !== null) $('#bazi_use_st_api').prop('checked', savedUseStApi === 'true');
    toggleCustomApiBlock();

    $('#bazi_use_st_api').on('change', toggleCustomApiBlock);
    $('#bazi_apiUrl').val(localStorage.getItem('bazi_api_url') || '');
    $('#bazi_apiKey').val(localStorage.getItem('bazi_api_key') || '');
    if(localStorage.getItem('bazi_api_model')) $('#bazi_modelInput').val(localStorage.getItem('bazi_api_model'));
    if(localStorage.getItem('bazi_gender')) $('#bazi_gender').val(localStorage.getItem('bazi_gender'));
    if(localStorage.getItem('bazi_birthday')) $('#bazi_birthday').val(localStorage.getItem('bazi_birthday'));

    try {
        const res = await fetch('https://cdn.jsdelivr.net/gh/modood/Administrative-divisions-of-China/dist/pca.json');
        const rawData = await res.json();
        let orderedData = {};
        for (let prov in rawData) {
            if (!SPECIAL_PROVS.includes(prov)) orderedData[prov] = rawData[prov];
        }
        SPECIAL_PROVS.forEach(sp => { orderedData[sp] = "special"; });
        orderedData[OTHER_KEY] = "other";
        pcaData = orderedData;
        $('#bazi_birth-loading').text(""); 
    } catch (e) {
        pcaData = {}; 
        SPECIAL_PROVS.forEach(sp => { pcaData[sp] = "special"; });
        pcaData[OTHER_KEY] = "other";
        $('#bazi_birth-loading').text("(离线)"); 
    }

    setupLocationGroup('bazi_birth');
    setupLocationGroup('bazi_live');

    $('#bazi_castBtn').on('click', castLiuyao);
    $('#bazi_sendBtn').on('click', sendRequest);
});

function toggleCustomApiBlock() {
    if ($('#bazi_use_st_api').is(':checked')) $('#bazi_custom_api_block').slideUp('fast');
    else $('#bazi_custom_api_block').slideDown('fast');
}

function setupLocationGroup(prefix) {
    const group = $(`#${prefix}-group`);
    const provSelect = group.find('.prov');
    provSelect.empty().append('<option value="">请选择省份</option>');
    for (let prov in pcaData) provSelect.append(new Option(prov, prov));
    
    provSelect.on('change', () => updateCity(prefix));
    group.find('.city').on('change', () => updateDist(prefix));
}

function updateCity(prefix) {
    const group = $(`#${prefix}-group`);
    const prov = group.find('.prov').val();
    const citySelect = group.find('.city').empty().append('<option value="">请选择城市</option>');
    const distSelect = group.find('.dist').empty().append('<option value="">请选择区县</option>');
    const otherInput = group.find('.other');
    
    if (!prov) { citySelect.show(); distSelect.show(); otherInput.hide(); return; }
    if (prov === OTHER_KEY) { citySelect.hide(); distSelect.hide(); otherInput.show(); }
    else if (SPECIAL_PROVS.includes(prov) || pcaData[prov] === "special") { citySelect.hide(); distSelect.hide(); otherInput.hide(); }
    else {
        citySelect.show(); distSelect.show(); otherInput.hide();
        for (let c in pcaData[prov]) citySelect.append(new Option(c, c));
    }
}

function updateDist(prefix) {
    const group = $(`#${prefix}-group`);
    const prov = group.find('.prov').val();
    const city = group.find('.city').val();
    const distSelect = group.find('.dist').empty().append('<option value="">请选择区县</option>');
    if(city && pcaData[prov] && pcaData[prov][city]) {
        pcaData[prov][city].forEach(d => distSelect.append(new Option(d, d)));
    }
}

function getLocationString(prefix) {
    const group = $(`#${prefix}-group`);
    const prov = group.find('.prov').val();
    if (!prov) return "";
    if (prov === OTHER_KEY) return group.find('.other').val().trim();
    if (SPECIAL_PROVS.includes(prov)) return prov;
    return `${prov}${group.find('.city').val()}${group.find('.dist').val()}`;
}

async function sendRequest() {
    const useStApi = $('#bazi_use_st_api').is(':checked');
    const apiUrl = $('#bazi_apiUrl').val().trim();
    const apiKey = $('#bazi_apiKey').val().trim();
    const modelName = $('#bazi_modelInput').val(); 
    
    const gender = $('#bazi_gender').val();
    const birthday = $('#bazi_birthday').val();
    let birthTime = $('#bazi_birthTime').val().trim();
    const birthPlace = getLocationString('bazi_birth');
    const livePlace = getLocationString('bazi_live');
    const wish = $('#bazi_wish').val().trim();
    const liuyaoData = $('#bazi_liuyaoResultData').val();
    const btn = $('#bazi_sendBtn');

    if(!useStApi && (!apiUrl || !apiKey || !modelName)) return toastr.warning("请填写自定义 API 配置，或勾选使用酒馆主 API！");
    if(!birthday) return toastr.warning("请选择阳历生日！");
    if(!birthPlace || !livePlace) return toastr.warning("请完整填写出生地和现居地！");
    if(!wish) return toastr.warning("请填写您的心愿！");
    if(!liuyaoData) return toastr.warning("【警告】请先点击上方按钮抛掷铜钱起卦，再进行排盘结印！");
    if(!birthTime) birthTime = "任选当天吉时";

    localStorage.setItem('bazi_use_st_api', useStApi);
    localStorage.setItem('bazi_api_url', apiUrl);
    localStorage.setItem('bazi_api_key', apiKey);
    localStorage.setItem('bazi_api_model', modelName);
    localStorage.setItem('bazi_gender', gender);
    localStorage.setItem('bazi_birthday', birthday);

    const todayDate = new Date();
    const todayStr = `${todayDate.getFullYear()}年${todayDate.getMonth() + 1}月${todayDate.getDate()}日`;

    const systemPrompt = `
  <identity>
  你现在是一个精通《周易》卦爻辞及体用生克之法，且深谙中国传统八字命理的专业研究人员。你熟读穷通宝典、三命通会、滴天髓、渊海子平、千里命稿、协纪辨方书、果老星宗、子平真诠、神峰通考等一系列书籍。你精通排大运（阳年：甲丙戊庚壬；阴年：乙丁己辛癸。阳男阴女顺排，阴男阳女逆排，以月干支为基准。小孩交大运前以月柱干支为大运十天干十二地支）。
  </identity>
  
在传统命理的架构中，八字与六爻对应着宏观的“体”与微观的“用”。推演需严格遵循以下规则：
第一，理清尺度：八字是先天定局加流年演播，定大势。六爻讲究“无事不占，不动不占”，捕捉起心动念瞬间的微观气运。
第二，拒绝线性思维：绝不能因八字走财运，就判定用户其她所有博弈皆稳赢。若六爻显现财爻受克或兄弟劫财，依然会翻车。“八字决定能赢多少，六爻决定这一把输赢”。
第三，必须严格遵循“先观命理之大势，再决行事之进退”的固定次序（先命后卜）。

【日期推演】(最重要)
当前现实日期是：${todayStr}。
请在推演前，先根据用户的【愿望内容】确立“起始日期”：
1. 若用户愿望中包含完整日期或相对时间（如明天、下周三、下个月某号），请以 ${todayStr} 为基准推算出具体的“起始日期”。
2. 若用户愿望中未提及任何时间，则默认“起始日期”为 ${todayStr}（今天）。
3. 如果起始日期的推演结果为“大忌(凶)”，你需要为用户另择吉日，择日范围必须严格限制在【起始日期】至【起始日期后7天】之间。

常用流程：
> 核心规则：八字体现用户宏观大势，六爻决定具体愿望成功率。
以确立好的“起始日期”为准进行推演：
if 八字&六爻 == 凶
→ 今日大忌，直接卜算【起始日期后7天内】的最佳日期作为最佳日期。
else 最佳日期即为“起始日期”（尽快达成期许）。
根据最终敲定的最佳日期（必定不会出现八字&六爻 == 凶）进行深度推演：
if 八字&六爻 == 吉
→ 欧皇气运加身，直接输出该日最佳方案（方位、时辰、口诀等）。
if 八字 == 吉 六爻 == 凶
→ 细节容易翻车，更需卜算如何避免踩坑（如歪卡）和补救措施如换时辰、换玄学物、避开某煞方。
if 八字 == 凶 六爻 == 吉
→ 非酋翻身局，额外卜算用户何时停手。`;

    const gameInfo = extractGameContext(wish);

    const userPrompt = `下面是要根据用户输入组合的信息：
用户阳历生日是：${birthday}
出生时间是：${birthTime}
出生在：${birthPlace}
现住：${livePlace}
性别：${gender}。
${gameInfo}
愿望内容：【${wish}】

【用户刚刚针对该愿望起的六爻金钱课结果】
${liuyaoData}

请你结合四柱八字大盘与上述已推算好的六爻本卦/变卦，根据你所熟读的书籍经验，学习一下，具体在什么时间，在用户家里，朝向哪方，口号什么的，根据常见谷子五行分类（棉花娃娃，马口铁吧唧，亚克力立牌，纸质镭射票等）如何利用元素相关谷子摆阵，能让【${wish}】比较欧？

【大师测算准则】
1. 时辰和朝向必须反复测算五次，确保正确无误。
2. 口号必须结合愿望，不能太俗，避免生僻字，必须简洁好记。
3. 如果遇到抽卡歪卡等突发情况，请在总结中提供调整方案。
4. 详细步骤中，允许使用 Markdown 格式（如加粗、列表、标题等）来优化排版，让用户一目了然。

【输出格式准则】
请必须以严格的 JSON 格式返回最终结果，不要包含额外文本：
{
  "summary": "一句话总结（如：明日午时面朝东南大喊xx口号，歪卡调整方案等）",
  "hexagram_interpretation": "针对本卦与变卦的解读，简洁，通俗易懂",
  "details": "具体的执行步骤、详细解释（包括八字简析、时间、方位、谷子阵法摆放等详细内容）"
}`;

    const finalPrompt = systemPrompt + "\n\n" + userPrompt;

    btn.text("🙏 灵力流转，八字六爻推演中...").prop('disabled', true);
    $('#bazi_summary-content, #bazi_hexagram-content, #bazi_details-content').html("加载中...");

    try {
        let aiContentString = "";

        if (useStApi) {
            const { generateRaw } = SillyTavern.getContext();
            aiContentString = await generateRaw({
                systemPrompt: systemPrompt,
                prompt: userPrompt
            });
            if (!aiContentString) throw new Error("酒馆 API 返回空值，请检查当前主 API 连接状态。");
        } else {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: modelName, 
                    messages: [
                        {"role": "system", "content": systemPrompt},
                        {"role": "user", "content": userPrompt}
                    ],
                    response_format: { type: "json_object" } 
                })
            });

            if (!response.ok) throw new Error(`API 报错 (状态码 ${response.status}): ${await response.text()}`);
            const data = await response.json();
            aiContentString = data.choices[0].message.content;
        }

        aiContentString = aiContentString.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        try {
            const aiResult = JSON.parse(aiContentString);
            if (typeof marked !== 'undefined') {
                $('#bazi_summary-content').html(marked.parse(aiResult.summary || "未获取到总结"));
                $('#bazi_hexagram-content').html(marked.parse(aiResult.hexagram_interpretation || "未获取到解读"));
                $('#bazi_details-content').html(marked.parse(aiResult.details || "未获取到详细内容"));
            } else {
                $('#bazi_summary-content').text(aiResult.summary);
                $('#bazi_hexagram-content').text(aiResult.hexagram_interpretation);
                $('#bazi_details-content').text(aiResult.details);
            }
        } catch (parseError) {
            $('#bazi_summary-content').html("⚠️ 模型未能返回标准 JSON");
            $('#bazi_hexagram-content').html("请查看下方完整回复。");
            $('#bazi_details-content').html(typeof marked !== 'undefined' ? marked.parse(aiContentString) : aiContentString);
        }

    } catch (error) {
        console.error(error);
        $('#bazi_summary-content').html("请求失败");
        $('#bazi_hexagram-content').html("请求失败");
        $('#bazi_details-content').html(error.message);
    } finally {
        btn.text("🙏 结印排盘，生成专属欧气阵法").prop('disabled', false);
    }
                                                                         }
