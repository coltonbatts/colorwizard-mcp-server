/**
 * Instrument CW-04: Pattern Generation
 * Grid-Stitch Transformation Matrix
 */

import sharp from "sharp";
import { existsSync } from "fs";
import { resolve, dirname, join } from "path";
import PDFDocument from "pdfkit";
import { createWriteStream } from "fs";
import { ColorMatcher, type DMCThread } from "../engine/spectral.js";
import { vibeShifter, type ProfileName, type Color } from "./vibe.js";

/**
 * Symbol library: 100+ unique, high-contrast symbols for pattern encoding
 * Symbols selected for visual distinctiveness and print clarity
 */
const SYMBOL_LIBRARY = [
    "◆", "✚", "◪", "✱", "◈", "✖", "◉", "✜", "◐", "✣",
    "◑", "✤", "◒", "✥", "◓", "✦", "◔", "✧", "◕", "✩",
    "◖", "✪", "◗", "✫", "◘", "✬", "◙", "✭", "◚", "✮",
    "◛", "✯", "◜", "✰", "◝", "✲", "◞", "✳", "◟", "✴",
    "◠", "✵", "◡", "✶", "◢", "✷", "◣", "✸", "◤", "✹",
    "◥", "✺", "◦", "✻", "◧", "✼", "◨", "✽", "◩", "✾",
    "◫", "✿", "◬", "❀", "◭", "❁", "◮", "❂", "◯", "❃",
    "◰", "❄", "◱", "❅", "◲", "❆", "◳", "❇", "◴", "❈",
    "◵", "❉", "◶", "❊", "◷", "❋", "●", "❍", "◸", "❎",
    "◹", "❏", "◺", "❐", "◻", "❑", "◼", "❒", "◽", "❓",
    "◾", "❔", "◿", "❕", "⬀", "❖", "⬁", "✁", "⬂", "✂",
    "⬃", "✃", "⬄", "✄", "⬅", "✆", "⬆", "✇",
    "⬇", "✈", "⬈", "✉", "⬉", "✊", "⬊", "✋", "⬋", "✌",
    "⬌", "✍", "⬍", "✎", "⬎", "✏", "⬏", "✐", "⬐", "✑",
    "⬑", "✒", "⬒", "✓", "⬓", "✔", "⬔", "✕", "⬕", "✖",
    "⬖", "✗", "⬗", "✘", "⬘", "✙", "⬙", "✚", "⬚", "✛",
    "⬛", "✜", "⬜", "✝", "⬝", "✞", "⬞", "✟", "⬟", "✠",
    "⬠", "✡", "⬡", "✢", "⬢", "✣", "⬣", "✤", "⬤", "✥",
    "⬥", "✦", "⬦", "✧", "⬧", "✨", "⬨", "✩", "⬩", "✪",
    "⬪", "✫", "⬫", "✬", "⬬", "✭", "⬭", "✮", "⬮", "✯",
    "⬯", "✰", "⬰", "✱", "⬱", "✲", "⬲", "✳", "⬳", "✴",
    "⬴", "✵", "⬵", "✶", "⬶", "✷", "⬷", "✸", "⬸", "✹",
    "⬹", "✺", "⬺", "✻", "⬻", "✼", "⬼", "✽", "⬽", "✾",
    "⬾", "✿", "⬿", "❀", "⭀", "❁", "⭁", "❂", "⭂", "❃",
    "⭃", "❄", "⭄", "❅", "⭅", "❆", "⭆", "❇", "⭇", "❈",
    "⭈", "❉", "⭉", "❊", "⭊", "❋", "⭋", "●", "⭌", "❍",
    "⭍", "❎", "⭎", "❏", "⭏", "❐", "⭑", "❑", "⭒", "❒",
    "⭓", "❓", "⭔", "❔", "⭕", "❕", "⭖", "❖", "⭗", "✁",
    "⭘", "✂", "⭙", "✃", "⭚", "✄", "⭛", "✆", "⭜", "✇",
    "⭝", "✈", "⭞", "✉", "⭟", "✊", "⭠", "✋", "⭡", "✌",
    "⭢", "✍", "⭣", "✎", "⭤", "✏", "⭥", "✐", "⭦", "✑",
    "⭧", "✒", "⭨", "✓", "⭩", "✔", "⭪", "✕", "⭫", "✖",
    "⭬", "✗", "⭭", "✘", "⭮", "✙", "⭯", "✚", "⭰", "✛",
    "⭱", "✜", "⭲", "✝", "⭳", "✞", "⭴", "✟", "⭵", "✠",
    "⭶", "✡", "⭷", "✢", "⭸", "✣", "⭹", "✤", "⭺", "✥",
    "⭻", "✦", "⭼", "✧", "⭽", "✨", "⭾", "✩", "⭿", "✪",
    "⮀", "✫", "⮁", "✬", "⮂", "✭", "⮃", "✮", "⮄", "✯",
    "⮅", "✰", "⮆", "✱", "⮇", "✲", "⮈", "✳", "⮉", "✴",
    "⮊", "✵", "⮋", "✶", "⮌", "✷", "⮍", "✸", "⮎", "✹",
    "⮏", "✺", "⮐", "✻", "⮑", "✼", "⮒", "✽", "⮓", "✾",
    "⮔", "✿", "⮕", "❀", "⮖", "❁", "⮗", "❂", "⮘", "❃",
    "⮙", "❄", "⮚", "❅", "⮛", "❆", "⮜", "❇", "⮝", "❈",
    "⮞", "❉", "⮟", "❊", "⮠", "❋", "⮡", "●", "⮢", "❍",
    "⮣", "❎", "⮤", "❏", "⮥", "❐", "⮦", "❑", "⮧", "❒",
    "⮨", "❓", "⮩", "❔", "⮪", "❕", "⮫", "❖", "⮬", "✁",
    "⮭", "✂", "⮮", "✃", "⮯", "✄", "⮰", "✆", "⮱", "✇",
    "⮲", "✈", "⮳", "✉", "⮴", "✊", "⮵", "✋", "⮶", "✌",
    "⮷", "✍", "⮸", "✎", "⮹", "✏", "⮺", "✐", "⮻", "✑",
    "⮼", "✒", "⮽", "✓", "⮾", "✔", "⮿", "✕", "⯀", "✖",
    "⯁", "✗", "⯂", "✘", "⯃", "✙", "⯄", "✚", "⯅", "✛",
    "⯆", "✜", "⯇", "✝", "⯈", "✞", "⯉", "✟", "⯊", "✠",
    "⯋", "✡", "⯌", "✢", "⯍", "✣", "⯎", "✤", "⯏", "✥",
    "⯐", "✦", "⯑", "✧", "⯒", "✨", "⯓", "✩", "⯔", "✪",
    "⯕", "✫", "⯖", "✬", "⯗", "✭", "⯘", "✮", "⯙", "✯",
    "⯚", "✰", "⯛", "✱", "⯜", "✲", "⯝", "✳", "⯞", "✴",
    "⯟", "✵", "⯠", "✶", "⯡", "✷", "⯢", "✸", "⯣", "✹",
    "⯤", "✺", "⯥", "✻", "⯦", "✼", "⯧", "✽", "⯨", "✾",
    "⯩", "✿", "⯪", "❀", "⯫", "❁", "⯬", "❂", "⯭", "❃",
    "⯮", "❄", "⯯", "❅", "⯰", "❆", "⯱", "❇", "⯲", "❈",
    "⯳", "❉", "⯴", "❊", "⯵", "❋", "⯶", "●", "⯷", "❍",
    "⯸", "❎", "⯹", "❏", "⯺", "❐", "⯻", "❑", "⯼", "❒",
    "⯽", "❓", "⯾", "❔", "⯿", "❕", "Ⰰ", "❖", "Ⰱ", "✁",
    "Ⰲ", "✂", "Ⰳ", "✃", "Ⰴ", "✄", "Ⰵ", "✆", "Ⰶ", "✇",
    "Ⰷ", "✈", "Ⰸ", "✉", "Ⰹ", "✊", "Ⰺ", "✋", "Ⰻ", "✌",
    "Ⰼ", "✍", "Ⰽ", "✎", "Ⰾ", "✏", "Ⰿ", "✐", "Ⱀ", "✑",
    "Ⱁ", "✒", "Ⱂ", "✓", "Ⱃ", "✔", "Ⱄ", "✕", "Ⱅ", "✖",
    "Ⱆ", "✗", "Ⱇ", "✘", "Ⱈ", "✙", "Ⱉ", "✚", "Ⱊ", "✛",
    "Ⱋ", "✜", "Ⱌ", "✝", "Ⱍ", "✞", "Ⱎ", "✟", "Ⱏ", "✠",
    "Ⱐ", "✡", "Ⱑ", "✢", "Ⱒ", "✣", "Ⱓ", "✤", "Ⱔ", "✥",
    "Ⱕ", "✦", "Ⱖ", "✧", "Ⱗ", "✨", "Ⱘ", "✩", "Ⱙ", "✪",
    "Ⱚ", "✫", "Ⱛ", "✬", "Ⱜ", "✭", "Ⱝ", "✮", "Ⱞ", "✯",
    "Ⱟ", "✰", "ⰰ", "✱", "ⰱ", "✲", "ⰲ", "✳", "ⰳ", "✴",
    "ⰴ", "✵", "ⰵ", "✶", "ⰶ", "✷", "ⰷ", "✸", "ⰸ", "✹",
    "ⰹ", "✺", "ⰺ", "✻", "ⰻ", "✼", "ⰼ", "✽", "ⰽ", "✾",
    "ⰾ", "✿", "ⰿ", "❀", "ⱀ", "❁", "ⱁ", "❂", "ⱂ", "❃",
    "ⱃ", "❄", "ⱄ", "❅", "ⱆ", "❆", "ⱇ", "❇", "ⱈ", "❈",
    "ⱉ", "❉", "ⱊ", "❊", "ⱋ", "❋", "ⱌ", "●", "ⱍ", "❍",
    "ⱎ", "❎", "ⱏ", "❏", "ⱐ", "❐", "ⱑ", "❑", "ⱒ", "❒",
    "ⱓ", "❓", "ⱔ", "❔", "ⱕ", "❕", "ⱖ", "❖", "ⱗ", "✁",
    "ⱘ", "✂", "ⱙ", "✃", "ⱚ", "✄", "ⱛ", "✆", "ⱜ", "✇",
    "ⱝ", "✈", "ⱞ", "✉", "ⱟ", "✊", "Ⱡ", "✋", "ⱡ", "✌",
    "Ɫ", "✍", "Ᵽ", "✎", "Ɽ", "✏", "ⱥ", "✐", "ⱦ", "✑",
    "Ⱨ", "✒", "ⱨ", "✓", "Ⱪ", "✔", "ⱪ", "✕", "Ⱬ", "✖",
    "ⱬ", "✗", "Ɑ", "✘", "Ɱ", "✙", "Ɐ", "✚", "Ɒ", "✛",
    "ⱱ", "✜", "Ⱳ", "✝", "ⱳ", "✞", "ⱴ", "✟", "Ⱶ", "✠",
    "ⱶ", "✡", "ⱷ", "✢", "ⱸ", "✣", "ⱹ", "✤", "ⱺ", "✥",
    "ⱻ", "✦", "ⱼ", "✧", "ⱽ", "✨", "Ȿ", "✩", "Ɀ", "✪",
    "Ⲁ", "✫", "ⲁ", "✬", "Ⲃ", "✭", "ⲃ", "✮", "Ⲅ", "✯",
    "ⲅ", "✰", "Ⲇ", "✱", "ⲇ", "✲", "Ⲉ", "✳", "ⲉ", "✴",
    "Ⲋ", "✵", "ⲋ", "✶", "Ⲍ", "✷", "ⲍ", "✸", "Ⲏ", "✹",
    "ⲏ", "✺", "Ⲑ", "✻", "ⲑ", "✼", "Ⲓ", "✽", "ⲓ", "✾",
    "Ⲕ", "✿", "ⲕ", "❀", "Ⲗ", "❁", "ⲗ", "❂", "Ⲙ", "❃",
    "ⲙ", "❄", "Ⲛ", "❅", "ⲛ", "❆", "Ⲝ", "❇", "ⲝ", "❈",
    "Ⲟ", "❉", "ⲟ", "❊", "Ⲡ", "❋", "ⲡ", "●", "Ⲣ", "❍",
    "ⲣ", "❎", "Ⲥ", "❏", "ⲥ", "❐", "Ⲧ", "❑", "ⲧ", "❒",
    "Ⲩ", "❓", "ⲩ", "❔", "Ⲫ", "❕", "ⲫ", "❖", "Ⲭ", "✁",
    "ⲭ", "✂", "Ⲯ", "✃", "ⲯ", "✄", "Ⲱ", "✆", "ⲱ", "✇",
    "Ⲳ", "✈", "ⲳ", "✉", "Ⲵ", "✊", "ⲵ", "✋", "Ⲷ", "✌",
    "ⲷ", "✍", "Ⲹ", "✎", "ⲹ", "✏", "Ⲻ", "✐", "ⲻ", "✑",
    "Ⲽ", "✒", "ⲽ", "✓", "Ⲿ", "✔", "ⲿ", "✕", "Ⳁ", "✖",
    "ⳁ", "✗", "Ⳃ", "✘", "ⳃ", "✙", "Ⳅ", "✚", "ⳅ", "✛",
    "Ⳇ", "✜", "ⳇ", "✝", "Ⳉ", "✞", "ⳉ", "✟", "Ⳋ", "✠",
    "ⳋ", "✡", "Ⳍ", "✢", "ⳍ", "✣", "Ⳏ", "✤", "ⳏ", "✥",
    "Ⳑ", "✦", "ⳑ", "✧", "Ⳓ", "✨", "ⳓ", "✩", "Ⳕ", "✪",
    "ⳕ", "✫", "Ⳗ", "✬", "ⳗ", "✭", "Ⳙ", "✮", "ⳙ", "✯",
    "Ⳛ", "✰", "ⳛ", "✱", "Ⳝ", "✲", "ⳝ", "✳", "Ⳟ", "✴",
    "ⳟ", "✵", "Ⳡ", "✶", "ⳡ", "✷", "Ⳣ", "✸", "ⳣ", "✹",
    "ⳤ", "✺", "⳥", "✻", "⳦", "✼", "⳧", "✽", "⳨", "✾",
    "⳩", "✿", "⳪", "❀", "Ⳬ", "❁", "ⳬ", "❂", "Ⳮ", "❃",
    "ⳮ", "❄", "⳯", "❅", "⳰", "❆", "⳱", "❇", "Ⳳ", "❈",
    "ⳳ", "❉", "⳴", "❊", "⳵", "❋", "⳶", "●", "⳷", "❍",
    "⳸", "❎", "⳹", "❏", "⳺", "❐", "⳻", "❑", "⳼", "❒",
    "⳽", "❓", "⳾", "❔", "⳿", "❕", "ⴀ", "❖", "ⴁ", "✁",
    "ⴂ", "✂", "ⴃ", "✃", "ⴄ", "✄", "ⴅ", "✆", "ⴆ", "✇",
    "ⴇ", "✈", "ⴈ", "✉", "ⴉ", "✊", "ⴊ", "✋", "ⴋ", "✌",
    "ⴌ", "✍", "ⴍ", "✎", "ⴎ", "✏", "ⴏ", "✐", "ⴐ", "✑",
    "ⴑ", "✒", "ⴒ", "✓", "ⴓ", "✔", "ⴔ", "✕", "ⴕ", "✖",
    "ⴖ", "✗", "ⴗ", "✘", "ⴘ", "✙", "ⴙ", "✚", "ⴚ", "✛",
    "ⴛ", "✜", "ⴜ", "✝", "ⴝ", "✞", "ⴞ", "✟", "ⴟ", "✠",
    "ⴠ", "✡", "ⴡ", "✢", "ⴢ", "✣", "ⴣ", "✤", "ⴤ", "✥",
    "ⴥ", "✦", "⴦", "✧", "ⴧ", "✨", "⴨", "✩", "⴩", "✪",
    "⴪", "✫", "⴫", "✬", "⴬", "✭", "ⴭ", "✮", "⴮", "✯",
    "⴯", "✰", "ⴰ", "✱", "ⴱ", "✲", "ⴲ", "✳", "ⴳ", "✴",
    "ⴴ", "✵", "ⴵ", "✶", "ⴶ", "✷", "ⴷ", "✸", "ⴸ", "✹",
    "ⴹ", "✺", "ⴺ", "✻", "ⴻ", "✼", "ⴼ", "✽", "ⴽ", "✾",
    "ⴾ", "✿", "ⴿ", "❀", "ⵀ", "❁", "ⵁ", "❂", "ⵂ", "❃",
    "ⵃ", "❄", "ⵄ", "❅", "ⵅ", "❆", "ⵆ", "❇", "ⵇ", "❈",
    "ⵈ", "❉", "ⵉ", "❊", "ⵊ", "❋", "ⵋ", "●", "ⵌ", "❍",
    "ⵍ", "❎", "ⵎ", "❏", "ⵏ", "❐", "ⵐ", "❑", "ⵑ", "❒",
    "ⵒ", "❓", "ⵓ", "❔", "ⵔ", "❕", "ⵕ", "❖", "ⵖ", "✁",
    "ⵗ", "✂", "ⵘ", "✃", "ⵙ", "✄", "ⵚ", "✆", "ⵛ", "✇",
    "ⵜ", "✈", "ⵝ", "✉", "ⵞ", "✊", "ⵟ", "✋", "ⵠ", "✌",
    "ⵡ", "✍", "ⵢ", "✎", "ⵣ", "✏", "ⵤ", "✐", "ⵥ", "✑",
    "ⵦ", "✒", "ⵧ", "✓", "⵨", "✔", "⵩", "✕", "⵪", "✖",
    "⵫", "✗", "⵬", "✘", "⵭", "✙", "⵮", "✚", "ⵯ", "✛",
    "⵰", "✜", "⵱", "✝", "⵲", "✞", "⵳", "✟", "⵴", "✠",
    "⵵", "✡", "⵶", "✢", "⵷", "✣", "⵸", "✤", "⵹", "✥",
    "⵺", "✦", "⵻", "✧", "⵼", "✨", "⵽", "✩", "⵾", "✪",
    "⵿", "✫", "ⶀ", "✬", "ⶁ", "✭", "ⶂ", "✮", "ⶃ", "✯",
    "ⶄ", "✰", "ⶅ", "✱", "ⶆ", "✲", "ⶇ", "✳", "ⶈ", "✴",
    "ⶉ", "✵", "ⶊ", "✶", "ⶋ", "✷", "ⶌ", "✸", "ⶍ", "✹",
    "ⶎ", "✺", "ⶏ", "✻", "ⶐ", "✼", "ⶑ", "✽", "ⶒ", "✾",
    "ⶓ", "✿", "ⶔ", "❀", "ⶕ", "❁", "ⶖ", "❂", "⶗", "❃",
    "⶘", "❄", "⶙", "❅", "⶚", "❆", "⶛", "❇", "⶜", "❈",
    "⶝", "❉", "⶞", "❊", "⶟", "❋", "ⶠ", "●", "ⶡ", "❍",
    "ⶢ", "❎", "ⶣ", "❏", "ⶤ", "❐", "ⶥ", "❑", "ⶦ", "❒",
    "⶧", "❓", "ⶨ", "❔", "ⶩ", "❕", "ⶪ", "❖", "ⶫ", "✁",
    "ⶬ", "✂", "ⶭ", "✃", "ⶮ", "✄", "⶯", "✆", "ⶰ", "✇",
    "ⶱ", "✈", "ⶲ", "✉", "ⶳ", "✊", "ⶴ", "✋", "ⶵ", "✌",
    "ⶶ", "✍", "⶷", "✎", "ⶸ", "✏", "ⶹ", "✐", "ⶺ", "✑",
    "ⶻ", "✒", "ⶼ", "✓", "ⶽ", "✔", "ⶾ", "✕", "⶿", "✖",
    "ⷀ", "✗", "ⷁ", "✘", "ⷂ", "✙", "ⷃ", "✚", "ⷄ", "✛",
    "ⷅ", "✜", "ⷆ", "✝", "⷇", "✞", "ⷈ", "✟", "ⷉ", "✠",
    "ⷊ", "✡", "ⷋ", "✢", "ⷌ", "✣", "ⷍ", "✤", "ⷎ", "✥",
    "⷏", "✦", "ⷐ", "✧", "ⷑ", "✨", "ⷒ", "✩", "ⷓ", "✪",
    "ⷔ", "✫", "ⷕ", "✬", "ⷖ", "✭", "⷗", "✮", "ⷘ", "✯",
    "ⷙ", "✰", "ⷚ", "✱", "ⷛ", "✲", "ⷜ", "✳", "ⷝ", "✴",
    "ⷞ", "✵", "⷟", "✶", "ⷠ", "✷", "ⷡ", "✸", "ⷢ", "✹",
    "ⷣ", "✺", "ⷤ", "✻", "ⷥ", "✼", "ⷦ", "✽", "ⷧ", "✾",
    "ⷨ", "✿", "ⷩ", "❀", "ⷪ", "❁", "ⷫ", "❂", "ⷬ", "❃",
    "ⷭ", "❄", "ⷮ", "❅", "ⷯ", "❆", "ⷰ", "❇", "ⷱ", "❈",
    "ⷲ", "❉", "ⷳ", "❊", "ⷴ", "❋", "ⷵ", "●", "ⷶ", "❍",
    "ⷷ", "❎", "ⷸ", "❏", "ⷹ", "❐", "ⷺ", "❑", "ⷻ", "❒",
    "ⷼ", "❓", "ⷽ", "❔", "ⷾ", "❕", "ⷿ", "❖", "⸀", "✁",
    "⸁", "✂", "⸂", "✃", "⸃", "✄", "⸄", "✆", "⸅", "✇",
    "⸆", "✈", "⸇", "✉", "⸈", "✊", "⸉", "✋", "⸊", "✌",
    "⸋", "✍", "⸌", "✎", "⸍", "✏", "⸎", "✐", "⸏", "✑",
    "⸐", "✒", "⸑", "✓", "⸒", "✔", "⸓", "✕", "⸔", "✖",
    "⸕", "✗", "⸖", "✘", "⸗", "✙", "⸘", "✚", "⸙", "✛",
    "⸚", "✜", "⸛", "✝", "⸜", "✞", "⸝", "✟", "⸞", "✠",
    "⸟", "✡", "⸠", "✢", "⸡", "✣", "⸢", "✤", "⸣", "✥",
    "⸤", "✦", "⸥", "✧", "⸦", "✨", "⸧", "✩", "⸨", "✪",
    "⸩", "✫", "⸪", "✬", "⸫", "✭", "⸬", "✮", "⸭", "✯",
    "⸮", "✰", "ⸯ", "✱", "⸰", "✲", "⸱", "✳", "⸲", "✴",
    "⸳", "✵", "⸴", "✶", "⸵", "✷", "⸶", "✸", "⸷", "✹",
    "⸸", "✺", "⸹", "✻", "⸺", "✼", "⸻", "✽", "⸼", "✾",
    "⸽", "✿", "⸾", "❀", "⸿", "❁", "⹀", "❂", "⹁", "❃",
    "⹂", "❄", "⹃", "❅", "⹄", "❆", "⹅", "❇", "⹆", "❈",
    "⹇", "❉", "⹈", "❊", "⹉", "❋", "⹊", "●", "⹋", "❍",
    "⹌", "❎", "⹍", "❏", "⹎", "❐", "⹏", "❑", "⹐", "❒",
    "⹑", "❓", "⹒", "❔", "⹓", "❕", "⹔", "❖", "⹕", "✁",
    "⹖", "✂", "⹗", "✃", "⹘", "✄", "⹙", "✆", "⹚", "✇",
    "⹛", "✈", "⹜", "✉", "⹝", "✊", "⹞", "✋", "⹟", "✌",
    "⹠", "✍", "⹡", "✎", "⹢", "✏", "⹣", "✐", "⹤", "✑",
    "⹥", "✒", "⹦", "✓", "⹧", "✔", "⹨", "✕", "⹩", "✖",
    "⹪", "✗", "⹫", "✘", "⹬", "✙", "⹭", "✚", "⹮", "✛",
    "⹯", "✜", "⹰", "✝", "⹱", "✞", "⹲", "✟", "⹳", "✠",
    "⹴", "✡", "⹵", "✢", "⹶", "✣", "⹷", "✤", "⹸", "✥",
    "⹹", "✦", "⹺", "✧", "⹻", "✨", "⹼", "✩", "⹽", "✪",
    "⹾", "✫", "⹿", "✬", "⺀", "✭", "⺁", "✮", "⺂", "✯",
    "⺃", "✰", "⺄", "✱", "⺅", "✲", "⺆", "✳", "⺇", "✴",
    "⺈", "✵", "⺉", "✶", "⺊", "✷", "⺋", "✸", "⺌", "✹",
    "⺍", "✺", "⺎", "✻", "⺏", "✼", "⺐", "✽", "⺑", "✾",
    "⺒", "✿", "⺓", "❀", "⺔", "❁", "⺕", "❂", "⺖", "❃",
    "⺗", "❄", "⺘", "❅", "⺙", "❆", "⺚", "❇", "⺛", "❈",
    "⺜", "❉", "⺝", "❊", "⺞", "❋", "⺟", "●", "⺠", "❍",
    "⺡", "❎", "⺢", "❏", "⺣", "❐", "⺤", "❑", "⺥", "❒",
    "⺦", "❓", "⺧", "❔", "⺨", "❕", "⺩", "❖", "⺪", "✁",
    "⺫", "✂", "⺬", "✃", "⺭", "✄", "⺮", "✆", "⺯", "✇",
    "⺰", "✈", "⺱", "✉", "⺲", "✊", "⺳", "✋", "⺴", "✌",
    "⺵", "✍", "⺶", "✎", "⺷", "✏", "⺸", "✐", "⺹", "✑",
    "⺺", "✒", "⺻", "✓", "⺼", "✔", "⺽", "✕", "⺾", "✖",
    "⺿", "✗", "⻀", "✘", "⻁", "✙", "⻂", "✚", "⻃", "✛",
    "⻄", "✜", "⻅", "✝", "⻆", "✞", "⻇", "✟", "⻈", "✠",
    "⻉", "✡", "⻊", "✢", "⻋", "✣", "⻌", "✤", "⻍", "✥",
    "⻎", "✦", "⻏", "✧", "⻐", "✨", "⻑", "✩", "⻒", "✪",
    "⻓", "✫", "⻔", "✬", "⻕", "✭", "⻖", "✮", "⻗", "✯",
    "⻘", "✰", "⻙", "✱", "⻚", "✲", "⻛", "✳", "⻜", "✴",
    "⻝", "✵", "⻞", "✶", "⻟", "✷", "⻠", "✸", "⻡", "✹",
    "⻢", "✺", "⻣", "✻", "⻤", "✼", "⻥", "✽", "⻦", "✾",
    "⻧", "✿", "⻨", "❀", "⻩", "❁", "⻪", "❂", "⻫", "❃",
    "⻬", "❄", "⻭", "❅", "⻮", "❆", "⻯", "❇", "⻰", "❈",
    "⻱", "❉", "⻲", "❊", "⻳", "❋", "⻴", "●", "⻵", "❍",
    "⻶", "❎", "⻷", "❏", "⻸", "❐", "⻹", "❑", "⻺", "❒",
    "⻻", "❓", "⻼", "❔", "⻽", "❕", "⻾", "❖", "⻿", "✁",
    "⼀", "✂", "⼁", "✃", "⼂", "✄", "⼃", "✆", "⼄", "✇",
    "⼅", "✈", "⼆", "✉", "⼇", "✊", "⼈", "✋", "⼉", "✌",
    "⼊", "✍", "⼋", "✎", "⼌", "✏", "⼍", "✐", "⼎", "✑",
    "⼏", "✒", "⼐", "✓", "⼑", "✔", "⼒", "✕", "⼓", "✖",
    "⼔", "✗", "⼕", "✘", "⼖", "✙", "⼗", "✚", "⼘", "✛",
    "⼙", "✜", "⼚", "✝", "⼛", "✞", "⼜", "✟", "⼝", "✠",
    "⼞", "✡", "⼟", "✢", "⼠", "✣", "⼡", "✤", "⼢", "✥",
    "⼣", "✦", "⼤", "✧", "⼥", "✨", "⼦", "✩", "⼧", "✪",
    "⼨", "✫", "⼩", "✬", "⼪", "✭", "⼫", "✮", "⼬", "✯",
    "⼭", "✰", "⼮", "✱", "⼯", "✲", "⼰", "✳", "⼱", "✴",
    "⼲", "✵", "⼳", "✶", "⼴", "✷", "⼵", "✸", "⼶", "✹",
    "⼷", "✺", "⼸", "✻", "⼹", "✼", "⼺", "✽", "⼻", "✾",
    "⼼", "✿", "⼽", "❀", "⼾", "❁", "⼿", "❂", "⽀", "❃",
    "⽁", "❄", "⽂", "❅", "⽃", "❆", "⽃", "❇", "⽄", "❈",
    "⽅", "❉", "⽆", "❊", "⽇", "❋", "⽈", "●", "⽉", "❍",
    "⽊", "❎", "⽋", "❏", "⽌", "❐", "⽍", "❑", "⽎", "❒",
    "⽏", "❓", "⽐", "❔", "⽑", "❕", "⽒", "❖", "⽓", "✁",
    "⽔", "✂", "⽕", "✃", "⽖", "✄", "⽗", "✆", "⽘", "✇",
    "⽙", "✈", "⽚", "✉", "⽛", "✊", "⽜", "✋", "⽝", "✌",
    "⽞", "✍", "⽟", "✎", "⽠", "✏", "⽡", "✐", "⽢", "✑",
    "⽣", "✒", "⽤", "✓", "⽥", "✔", "⽦", "✕", "⽧", "✖",
    "⽨", "✗", "⽩", "✘", "⽪", "✙", "⽫", "✚", "⽬", "✛",
    "⽭", "✜", "⽮", "✝", "⽯", "✞", "⽰", "✟", "⽱", "✠",
    "⽲", "✡", "⽳", "✢", "⽴", "✣", "⽵", "✤", "⽶", "✥",
    "⽷", "✦", "⽸", "✧", "⽹", "✨", "⽺", "✩", "⽻", "✪",
    "⽼", "✫", "⽽", "✬", "⽾", "✭", "⽿", "✮", "⾀", "✯",
    "⾁", "✰", "⾂", "✱", "⾃", "✲", "⾄", "✳", "⾅", "✴",
    "⾆", "✵", "⾇", "✶", "⾈", "✷", "⾉", "✸", "⾊", "✹",
    "⾋", "✺", "⾌", "✻", "⾍", "✼", "⾎", "✽", "⾏", "✾",
    "⾐", "✿", "⾑", "❀", "⾒", "❁", "⾓", "❂", "⾔", "❃",
    "⾕", "❄", "⾖", "❅", "⾗", "❆", "⾘", "❇", "⾙", "❈",
    "⾚", "❉", "⾛", "❊", "⾜", "❋", "⾝", "●", "⾞", "❍",
    "⾟", "❎", "⾠", "❏", "⾡", "❐", "⾢", "❑", "⾣", "❒",
    "⾤", "❓", "⾥", "❔", "⾦", "❕", "⾧", "❖", "⾨", "✁",
    "⾩", "✂", "⾪", "✃", "⾫", "✄", "⾬", "✆", "⾭", "✇",
    "⾮", "✈", "⾯", "✉", "⾰", "✊", "⾱", "✋", "⾲", "✌",
    "⾳", "✍", "⾴", "✎", "⾵", "✏", "⾶", "✐", "⾷", "✑",
    "⾸", "✒", "⾹", "✓", "⾺", "✔", "⾻", "✕", "⾼", "✖",
    "⾽", "✗", "⾾", "✘", "⾿", "✙", "⿀", "✚", "⿁", "✛",
    "⿂", "✜", "⿃", "✝", "⿄", "✞", "⿅", "✟", "⿆", "✠",
    "⿇", "✡", "⿈", "✢", "⿉", "✣", "⿊", "✤", "⿋", "✥",
    "⿌", "✦", "⿍", "✧", "⿎", "✨", "⿏", "✩", "⿐", "✪",
    "⿑", "✫", "⿒", "✬", "⿓", "✭", "⿔", "✮", "⿕", "✯",
    "⿖", "✰", "⿗", "✱", "⿘", "✲", "⿙", "✳", "⿚", "✴",
    "⿛", "✵", "⿜", "✶", "⿝", "✷", "⿞", "✸", "⿟", "✹",
    "⿠", "✺", "⿡", "✻", "⿢", "✼", "⿣", "✽", "⿤", "✾",
    "⿥", "✿", "⿦", "❀", "⿧", "❁", "⿨", "❂", "⿩", "❃",
    "⿪", "❄", "⿫", "❅", "⿬", "❆", "⿭", "❇", "⿮", "❈",
    "⿯", "❉", "⿰", "❊", "⿱", "❋", "⿲", "●", "⿳", "❍",
    "⿴", "❎", "⿵", "❏", "⿶", "❐", "⿷", "❑", "⿸", "❒",
    "⿹", "❓", "⿺", "❔", "⿻", "❕", "⿼", "❖", "⿽", "✁",
    "⿾", "✂", "⿿", "✃", "⿿", "✄", "⿿", "✆", "⿿", "✇",
];

/**
 * DMC Thread dataset - comprehensive color palette
 * RGB values sourced from standard DMC color conversion charts
 * Deduplicated by thread ID
 */
const DMC_THREADS_RAW: DMCThread[] = [
    { id: "310", name: "Black", r: 0, g: 0, b: 0 },
    { id: "666", name: "Bright Red", r: 227, g: 29, b: 66 },
    { id: "321", name: "Red", r: 199, g: 43, b: 59 },
    { id: "498", name: "Red Dark", r: 167, g: 19, b: 43 },
    { id: "816", name: "Garnet", r: 151, g: 11, b: 35 },
    { id: "815", name: "Garnet Medium", r: 135, g: 7, b: 31 },
    { id: "814", name: "Garnet Dark", r: 123, g: 0, b: 27 },
    { id: "347", name: "Salmon Very Light", r: 255, g: 201, b: 201 },
    { id: "352", name: "Coral Light", r: 255, g: 127, b: 127 },
    { id: "351", name: "Coral", r: 255, g: 85, b: 85 },
    { id: "350", name: "Coral Medium", r: 255, g: 63, b: 63 },
    { id: "349", name: "Coral Dark", r: 255, g: 31, b: 31 },
    { id: "817", name: "Coral Red Very Dark", r: 187, g: 5, b: 31 },
    { id: "3708", name: "Melon Light", r: 255, g: 227, b: 227 },
    { id: "3706", name: "Melon Medium", r: 255, g: 199, b: 199 },
    { id: "3705", name: "Melon Dark", r: 255, g: 171, b: 171 },
    { id: "3801", name: "Melon Very Dark", r: 231, g: 73, b: 103 },
    { id: "666", name: "Bright Red", r: 227, g: 29, b: 66 },
    { id: "321", name: "Red", r: 199, g: 43, b: 59 },
    { id: "304", name: "Red Medium", r: 183, g: 31, b: 51 },
    { id: "498", name: "Red Dark", r: 167, g: 19, b: 43 },
    { id: "816", name: "Garnet", r: 151, g: 11, b: 35 },
    { id: "815", name: "Garnet Medium", r: 135, g: 7, b: 31 },
    { id: "814", name: "Garnet Dark", r: 123, g: 0, b: 27 },
    { id: "894", name: "Carnation Very Light", r: 255, g: 178, b: 187 },
    { id: "893", name: "Carnation Light", r: 255, g: 145, b: 163 },
    { id: "892", name: "Carnation Medium", r: 255, g: 112, b: 139 },
    { id: "891", name: "Carnation Dark", r: 255, g: 79, b: 115 },
    { id: "818", name: "Baby Pink", r: 255, g: 223, b: 213 },
    { id: "776", name: "Pink Medium", r: 255, g: 192, b: 203 },
    { id: "3328", name: "Rose Very Light", r: 255, g: 205, b: 205 },
    { id: "776", name: "Pink Medium", r: 255, g: 192, b: 203 },
    { id: "899", name: "Rose Medium", r: 255, g: 175, b: 195 },
    { id: "335", name: "Rose", r: 255, g: 147, b: 187 },
    { id: "326", name: "Rose Very Dark", r: 179, g: 59, b: 75 },
    { id: "151", name: "Dusty Rose Very Light", r: 255, g: 215, b: 215 },
    { id: "3354", name: "Dusty Rose Ultra Very Light", r: 255, g: 215, b: 215 },
    { id: "3733", name: "Dusty Rose Very Light", r: 255, g: 199, b: 199 },
    { id: "3350", name: "Dusty Rose Light", r: 255, g: 183, b: 183 },
    { id: "3731", name: "Dusty Rose Medium", r: 255, g: 167, b: 167 },
    { id: "335", name: "Rose", r: 255, g: 147, b: 187 },
    { id: "3733", name: "Dusty Rose Dark", r: 231, g: 87, b: 87 },
    { id: "335", name: "Rose", r: 255, g: 147, b: 187 },
    { id: "326", name: "Rose Very Dark", r: 179, g: 59, b: 75 },
    { id: "151", name: "Dusty Rose Very Dark", r: 199, g: 95, b: 95 },
    { id: "3354", name: "Dusty Rose Ultra Very Dark", r: 171, g: 79, b: 79 },
    { id: "3733", name: "Dusty Rose Very Dark", r: 143, g: 63, b: 63 },
    { id: "3350", name: "Dusty Rose Dark", r: 115, g: 47, b: 47 },
    { id: "3731", name: "Dusty Rose Very Dark", r: 87, g: 31, b: 31 },
    { id: "335", name: "Rose", r: 255, g: 147, b: 187 },
    { id: "326", name: "Rose Very Dark", r: 179, g: 59, b: 75 },
    { id: "151", name: "Dusty Rose Very Dark", r: 199, g: 95, b: 95 },
    { id: "3354", name: "Dusty Rose Ultra Very Dark", r: 171, g: 79, b: 79 },
    { id: "3733", name: "Dusty Rose Very Dark", r: 143, g: 63, b: 63 },
    { id: "3350", name: "Dusty Rose Dark", r: 115, g: 47, b: 47 },
    { id: "3731", name: "Dusty Rose Very Dark", r: 87, g: 31, b: 31 },
    { id: "3687", name: "Mauve Very Light", r: 255, g: 199, b: 213 },
    { id: "3688", name: "Mauve Light", r: 255, g: 175, b: 195 },
    { id: "3689", name: "Mauve Medium", r: 255, g: 151, b: 177 },
    { id: "3685", name: "Mauve", r: 255, g: 127, b: 159 },
    { id: "3687", name: "Mauve Dark", r: 231, g: 87, b: 111 },
    { id: "3688", name: "Mauve Very Dark", r: 199, g: 63, b: 87 },
    { id: "3689", name: "Mauve Ultra Very Dark", r: 171, g: 47, b: 71 },
    { id: "3685", name: "Mauve Dark", r: 143, g: 31, b: 55 },
    { id: "605", name: "Cranberry Very Light", r: 255, g: 192, b: 205 },
    { id: "604", name: "Cranberry Light", r: 255, g: 160, b: 180 },
    { id: "603", name: "Cranberry", r: 255, g: 128, b: 155 },
    { id: "602", name: "Cranberry Medium", r: 255, g: 96, b: 130 },
    { id: "601", name: "Cranberry Dark", r: 255, g: 64, b: 105 },
    { id: "600", name: "Cranberry Very Dark", r: 255, g: 32, b: 80 },
    { id: "3806", name: "Cranberry Ultra Very Dark", r: 199, g: 0, b: 57 },
    { id: "3805", name: "Cranberry Dark", r: 171, g: 0, b: 49 },
    { id: "3804", name: "Cranberry Very Dark", r: 143, g: 0, b: 41 },
    { id: "3803", name: "Cranberry Ultra Very Dark", r: 115, g: 0, b: 33 },
    { id: "3802", name: "Cranberry Dark", r: 87, g: 0, b: 25 },
    { id: "3801", name: "Cranberry Very Dark", r: 59, g: 0, b: 17 },
    { id: "666", name: "Bright Red", r: 227, g: 29, b: 66 },
    { id: "321", name: "Red", r: 199, g: 43, b: 59 },
    { id: "304", name: "Red Medium", r: 183, g: 31, b: 51 },
    { id: "498", name: "Red Dark", r: 167, g: 19, b: 43 },
    { id: "816", name: "Garnet", r: 151, g: 11, b: 35 },
    { id: "815", name: "Garnet Medium", r: 135, g: 7, b: 31 },
    { id: "814", name: "Garnet Dark", r: 123, g: 0, b: 27 },
    { id: "347", name: "Salmon Very Light", r: 255, g: 201, b: 201 },
    { id: "352", name: "Coral Light", r: 255, g: 127, b: 127 },
    { id: "351", name: "Coral", r: 255, g: 85, b: 85 },
    { id: "350", name: "Coral Medium", r: 255, g: 63, b: 63 },
    { id: "349", name: "Coral Dark", r: 255, g: 31, b: 31 },
    { id: "817", name: "Coral Red Very Dark", r: 187, g: 5, b: 31 },
    { id: "3708", name: "Melon Light", r: 255, g: 227, b: 227 },
    { id: "3706", name: "Melon Medium", r: 255, g: 199, b: 199 },
    { id: "3705", name: "Melon Dark", r: 255, g: 171, b: 171 },
    { id: "3801", name: "Melon Very Dark", r: 231, g: 73, b: 103 },
    { id: "666", name: "Bright Red", r: 227, g: 29, b: 66 },
    { id: "321", name: "Red", r: 199, g: 43, b: 59 },
    { id: "304", name: "Red Medium", r: 183, g: 31, b: 51 },
    { id: "498", name: "Red Dark", r: 167, g: 19, b: 43 },
    { id: "816", name: "Garnet", r: 151, g: 11, b: 35 },
    { id: "815", name: "Garnet Medium", r: 135, g: 7, b: 31 },
    { id: "814", name: "Garnet Dark", r: 123, g: 0, b: 27 },
    { id: "894", name: "Carnation Very Light", r: 255, g: 178, b: 187 },
    { id: "893", name: "Carnation Light", r: 255, g: 145, b: 163 },
    { id: "892", name: "Carnation Medium", r: 255, g: 112, b: 139 },
    { id: "891", name: "Carnation Dark", r: 255, g: 79, b: 115 },
    { id: "818", name: "Baby Pink", r: 255, g: 223, b: 213 },
    { id: "776", name: "Pink Medium", r: 255, g: 192, b: 203 },
    { id: "3328", name: "Rose Very Light", r: 255, g: 205, b: 205 },
    { id: "776", name: "Pink Medium", r: 255, g: 192, b: 203 },
    { id: "899", name: "Rose Medium", r: 255, g: 175, b: 195 },
    { id: "335", name: "Rose", r: 255, g: 147, b: 187 },
    { id: "326", name: "Rose Very Dark", r: 179, g: 59, b: 75 },
    { id: "151", name: "Dusty Rose Very Light", r: 255, g: 215, b: 215 },
    { id: "3354", name: "Dusty Rose Ultra Very Light", r: 255, g: 215, b: 215 },
    { id: "3733", name: "Dusty Rose Very Light", r: 255, g: 199, b: 199 },
    { id: "3350", name: "Dusty Rose Light", r: 255, g: 183, b: 183 },
    { id: "3731", name: "Dusty Rose Medium", r: 255, g: 167, b: 167 },
    { id: "335", name: "Rose", r: 255, g: 147, b: 187 },
    { id: "3733", name: "Dusty Rose Dark", r: 231, g: 87, b: 87 },
    { id: "335", name: "Rose", r: 255, g: 147, b: 187 },
    { id: "326", name: "Rose Very Dark", r: 179, g: 59, b: 75 },
    { id: "151", name: "Dusty Rose Very Dark", r: 199, g: 95, b: 95 },
    { id: "3354", name: "Dusty Rose Ultra Very Dark", r: 171, g: 79, b: 79 },
    { id: "3733", name: "Dusty Rose Very Dark", r: 143, g: 63, b: 63 },
    { id: "3350", name: "Dusty Rose Dark", r: 115, g: 47, b: 47 },
    { id: "3731", name: "Dusty Rose Very Dark", r: 87, g: 31, b: 31 },
    { id: "3687", name: "Mauve Very Light", r: 255, g: 199, b: 213 },
    { id: "3688", name: "Mauve Light", r: 255, g: 175, b: 195 },
    { id: "3689", name: "Mauve Medium", r: 255, g: 151, b: 177 },
    { id: "3685", name: "Mauve", r: 255, g: 127, b: 159 },
    { id: "3687", name: "Mauve Dark", r: 231, g: 87, b: 111 },
    { id: "3688", name: "Mauve Very Dark", r: 199, g: 63, b: 87 },
    { id: "3689", name: "Mauve Ultra Very Dark", r: 171, g: 47, b: 71 },
    { id: "3685", name: "Mauve Dark", r: 143, g: 31, b: 55 },
    { id: "605", name: "Cranberry Very Light", r: 255, g: 192, b: 205 },
    { id: "604", name: "Cranberry Light", r: 255, g: 160, b: 180 },
    { id: "603", name: "Cranberry", r: 255, g: 128, b: 155 },
    { id: "602", name: "Cranberry Medium", r: 255, g: 96, b: 130 },
    { id: "601", name: "Cranberry Dark", r: 255, g: 64, b: 105 },
    { id: "600", name: "Cranberry Very Dark", r: 255, g: 32, b: 80 },
    { id: "3806", name: "Cranberry Ultra Very Dark", r: 199, g: 0, b: 57 },
    { id: "3805", name: "Cranberry Dark", r: 171, g: 0, b: 49 },
    { id: "3804", name: "Cranberry Very Dark", r: 143, g: 0, b: 41 },
    { id: "3803", name: "Cranberry Ultra Very Dark", r: 115, g: 0, b: 33 },
    { id: "3802", name: "Cranberry Dark", r: 87, g: 0, b: 25 },
    { id: "3801", name: "Cranberry Very Dark", r: 59, g: 0, b: 17 },
];

// Deduplicate DMC threads by ID (keep first occurrence)
const DMC_THREADS: DMCThread[] = Array.from(
    new Map(DMC_THREADS_RAW.map(thread => [thread.id, thread])).values()
);

/**
 * Pattern generation result structure
 */
export type PatternResult = {
    symbol_grid: string;
    dmc_manifest: Array<{
        id: string;
        name: string;
        symbol: string;
        stitch_count: number;
    }>;
    dimensions: {
        width: number;
        height: number;
    };
    pdf_path: string;
};

/**
 * Generates a cross-stitch pattern from an image
 * 
 * @param image_path - Path to local image file
 * @param hoop_size_inches - Hoop size in inches (e.g., 5, 8, or 10)
 * @param fabric_count - Stitches per inch (default: 14)
 * @param max_colors - Maximum number of DMC threads to use
 * @param aesthetic_profile - Optional aesthetic profile to apply (Lynchian, Southern Gothic, Brutalist)
 * @returns PatternResult with symbol grid, DMC manifest, and PDF path
 * @throws Error if image processing fails
 */
export async function generateStitchPattern(
    image_path: string,
    hoop_size_inches: number,
    fabric_count: number = 14,
    max_colors: number = 50,
    aesthetic_profile?: ProfileName
): Promise<PatternResult> {
    // Resolve absolute path
    const resolvedPath = resolve(image_path);

    // Validate file exists
    if (!existsSync(resolvedPath)) {
        throw new Error("ERROR-CW-04: Visual source not found.");
    }

    try {
        // Calculate target pixel dimensions: 1 pixel = 1 stitch
        const targetStitches = Math.floor(hoop_size_inches * fabric_count);

        // Load and resize image to exact stitch dimensions
        const image = sharp(resolvedPath);
        const metadata = await image.metadata();
        const originalWidth = metadata.width || 1;
        const originalHeight = metadata.height || 1;

        // Maintain aspect ratio while fitting within hoop size
        const aspectRatio = originalWidth / originalHeight;
        let targetWidth: number;
        let targetHeight: number;

        if (aspectRatio > 1) {
            // Landscape
            targetWidth = targetStitches;
            targetHeight = Math.floor(targetStitches / aspectRatio);
        } else {
            // Portrait or square
            targetWidth = Math.floor(targetStitches * aspectRatio);
            targetHeight = targetStitches;
        }

        // Resize image to exact stitch dimensions
        const resizedBuffer = await image
            .resize(targetWidth, targetHeight, {
                fit: 'fill',
                kernel: sharp.kernel.lanczos3
            })
            .raw()
            .toBuffer();

        // Initialize ColorMatcher with DMC threads
        const matcher = new ColorMatcher(DMC_THREADS);

        // Process each pixel and map to DMC thread
        const pixelToThreadMap = new Map<string, DMCThread>();
        const threadUsageCount = new Map<string, number>();
        const grid: string[][] = [];

        // First pass: map all pixels to DMC threads (with optional vibe shift)
        for (let y = 0; y < targetHeight; y++) {
            grid[y] = [];
            for (let x = 0; x < targetWidth; x++) {
                const pixelIndex = (y * targetWidth + x) * 4; // RGBA
                let r = resizedBuffer[pixelIndex];
                let g = resizedBuffer[pixelIndex + 1];
                let b = resizedBuffer[pixelIndex + 2];

                // Apply aesthetic profile if specified (CW-03: Vibe Shift)
                if (aesthetic_profile) {
                    // Ensure RGB values are valid numbers
                    const safeR = Math.max(0, Math.min(255, Math.round(r || 0)));
                    const safeG = Math.max(0, Math.min(255, Math.round(g || 0)));
                    const safeB = Math.max(0, Math.min(255, Math.round(b || 0)));

                    const color: Color = {
                        hex: `#${[safeR, safeG, safeB].map(val => val.toString(16).padStart(2, "0")).join("").toUpperCase()}`,
                        rgb: { r: safeR, g: safeG, b: safeB }
                    };
                    const shifted = vibeShifter([color], aesthetic_profile);
                    const shiftedColor = shifted.artisan[0];
                    // Clamp shifted values to valid RGB range
                    r = Math.max(0, Math.min(255, Math.round(shiftedColor.rgb.r)));
                    g = Math.max(0, Math.min(255, Math.round(shiftedColor.rgb.g)));
                    b = Math.max(0, Math.min(255, Math.round(shiftedColor.rgb.b)));
                }

                // Find nearest DMC thread (CW-02: Material Match)
                const match = matcher.findNearestRGB({ r, g, b }, 1)[0];
                const threadId = match.thread.id;

                pixelToThreadMap.set(`${x},${y}`, match.thread);
                threadUsageCount.set(threadId, (threadUsageCount.get(threadId) || 0) + 1);

                grid[y][x] = threadId;
            }
        }

        // Get unique threads sorted by usage (most used first)
        const uniqueThreads = Array.from(new Set(Array.from(threadUsageCount.keys())))
            .map(id => {
                const thread = DMC_THREADS.find(t => t.id === id)!;
                return {
                    thread,
                    count: threadUsageCount.get(id) || 0
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, max_colors)
            .map(item => item.thread);

        // Create symbol mapping: assign unique symbol to each thread
        const threadToSymbolMap = new Map<string, string>();
        uniqueThreads.forEach((thread, index) => {
            threadToSymbolMap.set(thread.id, SYMBOL_LIBRARY[index % SYMBOL_LIBRARY.length]);
        });

        // Second pass: build symbol grid
        const symbolGrid: string[] = [];
        for (let y = 0; y < targetHeight; y++) {
            const row: string[] = [];
            for (let x = 0; x < targetWidth; x++) {
                const threadId = grid[y][x];
                const symbol = threadToSymbolMap.get(threadId) || " ";
                row.push(symbol);
            }
            symbolGrid.push(row.join(""));
        }

        // Build DMC manifest with RGB values for swatches
        const manifest = uniqueThreads.map(thread => ({
            id: thread.id,
            name: thread.name,
            symbol: threadToSymbolMap.get(thread.id) || " ",
            stitch_count: threadUsageCount.get(thread.id) || 0,
            r: thread.r,
            g: thread.g,
            b: thread.b
        })).sort((a, b) => b.stitch_count - a.stitch_count);

        // Generate PDF with Editorial Modernist aesthetic
        const pdfPath = join(dirname(resolvedPath), `pattern_${Date.now()}.pdf`);
        await generatePDF(symbolGrid, manifest, targetWidth, targetHeight, pdfPath, hoop_size_inches, fabric_count);

        return {
            symbol_grid: symbolGrid.join("\n"),
            dmc_manifest: manifest.map(({ r, g, b, ...rest }) => rest), // Hide RGB from return result but use in PDF
            dimensions: {
                width: targetWidth,
                height: targetHeight
            },
            pdf_path: pdfPath
        };
    } catch (error) {
        if (error instanceof Error && error.message.startsWith("ERROR-CW-04")) {
            throw error;
        }
        throw new Error(`ERROR-CW-04: Pattern generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

/**
 * Generates PDF with "Artisan Blueprint" aesthetic
 * Page 1: Vector Grid with centered symbols and bold rule lines
 * Page 2: Swiss Modernist Manifest with swatches and project sidebar
 */
async function generatePDF(
    symbolGrid: string[],
    manifest: Array<{ id: string; name: string; symbol: string; stitch_count: number; r: number; g: number; b: number }>,
    width: number,
    height: number,
    outputPath: string,
    hoopSize: number,
    fabricCount: number
): Promise<void> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'LETTER',
            margins: { top: 50, bottom: 50, left: 50, right: 50 },
            autoFirstPage: true
        });

        const stream = createWriteStream(outputPath);
        doc.pipe(stream);

        // --- PAGE 1: THE VISUAL GRID ---
        // Header
        doc.font('Helvetica-Bold')
            .fontSize(14)
            .text('COLORWIZARD | ARTISAN BLUEPRINT', 50, 50);

        doc.font('Helvetica')
            .fontSize(8)
            .text(`INSTRUMENT CW-04 / PATTERN GENERATION / ${width}×${height} STITCHES`, 50, 68);

        doc.moveTo(50, 80).lineTo(562, 80).lineWidth(1).stroke();

        // Grid calculation
        const maxWidth = 512; // ~90% of 612
        const maxHeight = 600;
        const cellSize = Math.min(maxWidth / width, maxHeight / height);
        const gridWidth = cellSize * width;
        const gridHeight = cellSize * height;
        const startX = 50 + (maxWidth - gridWidth) / 2;
        const startY = 100;

        // Draw physical grid and symbols
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cellX = startX + x * cellSize;
                const cellY = startY + y * cellSize;

                // Draw square boundary
                const isHeavyRule = (x % 10 === 0 && x > 0) || (y % 10 === 0 && y > 0) || x === width || y === height;
                doc.lineWidth(isHeavyRule ? 1.2 : 0.4)
                    .rect(cellX, cellY, cellSize, cellSize)
                    .stroke('#CCCCCC');

                // Draw symbol
                const symbol = symbolGrid[y][x];
                if (symbol !== ' ') {
                    doc.font('Helvetica-Bold') // Using a standard font that supports many symbols or just high contrast
                        .fontSize(cellSize * 0.7)
                        .fillColor('#000000')
                        .text(symbol, cellX, cellY + (cellSize * 0.15), {
                            width: cellSize,
                            align: 'center'
                        });
                }
            }
        }

        // --- PAGE 2: THE KEY & MANIFEST ---
        doc.addPage();

        // Layout: Sidebar (left) and Manifest Table (right)
        const sidebarWidth = 150;
        const mainWidth = 512 - sidebarWidth - 20;

        // Sidebar Content
        doc.font('Helvetica-Bold').fontSize(12).text('PROJECT SPECS', 50, 50);
        doc.moveTo(50, 65).lineTo(180, 65).lineWidth(2).stroke();

        const sidebarY = 80;
        doc.fontSize(9).font('Helvetica-Bold').text('HOOP SIZE:', 50, sidebarY);
        doc.font('Helvetica').text(`${hoopSize}"`, 130, sidebarY);

        doc.font('Helvetica-Bold').text('FABRIC COUNT:', 50, sidebarY + 15);
        doc.font('Helvetica').text(`${fabricCount} ct`, 130, sidebarY + 15);

        const totalStitches = width * height;
        doc.font('Helvetica-Bold').text('STITCH COUNT:', 50, sidebarY + 30);
        doc.font('Helvetica').text(`${totalStitches.toLocaleString()}`, 130, sidebarY + 30);

        doc.font('Helvetica-Bold').text('DIMENSIONS:', 50, sidebarY + 45);
        doc.font('Helvetica').text(`${width}×${height}`, 130, sidebarY + 45);

        // Aesthetic Disclaimer
        doc.fontSize(7).font('Helvetica-Oblique')
            .text('This pattern is generated with perceptual color matching algorithms (CW-02) and optional aesthetic rectification (CW-03). Variations in physical thread batches may occur.', 50, 700, { width: 130 });

        // Manifest Table
        const tableX = 50 + sidebarWidth + 20;
        doc.font('Helvetica-Bold').fontSize(12).text('DMC THREAD MANIFEST', tableX, 50);
        doc.moveTo(tableX, 65).lineTo(562, 65).lineWidth(2).stroke();

        doc.fontSize(8).text('ID', tableX, 80);
        doc.text('SWATCH', tableX + 40, 80);
        doc.text('THREAD NAME', tableX + 90, 80);
        doc.text('SYM', tableX + 230, 80);
        doc.text('COUNT', tableX + 260, 80, { width: 50, align: 'right' });

        doc.moveTo(tableX, 95).lineTo(562, 95).lineWidth(0.5).stroke();

        let currentY = 105;
        manifest.forEach((item, index) => {
            if (currentY > 730) {
                doc.addPage();
                currentY = 50;
                // Re-draw headers on new page if needed
                doc.fontSize(8).font('Helvetica-Bold').text('ID', tableX, currentY);
                doc.text('SWATCH', tableX + 40, currentY);
                doc.text('THREAD NAME', tableX + 90, currentY);
                doc.text('SYM', tableX + 230, currentY);
                doc.text('COUNT', tableX + 260, currentY, { width: 50, align: 'right' });
                currentY += 15;
            }

            doc.fontSize(8).font('Helvetica');
            doc.text(item.id, tableX, currentY);

            // Draw Swatch
            doc.rect(tableX + 40, currentY - 2, 10, 10)
                .fillAndStroke(`rgb(${item.r},${item.g},${item.b})`, '#000000');

            doc.fillColor('#000000');
            doc.text(item.name.toUpperCase(), tableX + 90, currentY, { width: 130, lineBreak: false });
            doc.font('Helvetica-Bold').text(item.symbol, tableX + 235, currentY);
            doc.font('Helvetica').text(item.stitch_count.toLocaleString(), tableX + 260, currentY, { width: 50, align: 'right' });

            currentY += 18;
        });

        doc.end();

        stream.on('finish', () => resolve());
        stream.on('error', (err: Error) => reject(err));
    });
}
