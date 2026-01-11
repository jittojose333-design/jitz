const cheerio = require('cheerio');
const https = require('https');

const BASE_URL = 'https://nregastrep.nic.in/netnrega/';
const START_URL = 'https://nregastrep.nic.in/netnrega/materialwise_exp.aspx?lflag=eng&flg=v&state_code=16&state_name=KERALA&page=s&fin_year=2025-2026&Digest=iGHV9dpfm0nO4UVhdORvSQ';

const TARGET_DISTRICT = 'KOTTAYAM';
const TARGET_BLOCK = 'Uzhavoor'; // From previous output

let cookieStore = [];

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const opts = new URL(url);
        const options = {
            hostname: opts.hostname,
            path: opts.pathname + opts.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Cookie': cookieStore.join('; ')
            }
        };

        const req = https.request(options, (res) => {
            const setCookie = res.headers['set-cookie'];
            if (setCookie) {
                setCookie.forEach(c => {
                    const part = c.split(';')[0];
                    if (!cookieStore.includes(part)) cookieStore.push(part);
                });
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', e => reject(e));
        req.end();
    });
}

function findLink($doc, text) {
    const searchText = text.toLowerCase().trim();
    let targetHref = null;
    $doc('a').each((i, el) => {
        const linkText = $doc(el).text().toLowerCase().trim();
        if (linkText === searchText || linkText.includes(searchText)) {
            targetHref = $doc(el).attr('href');
            return false;
        }
    });
    return targetHref;
}

async function run() {
    try {
        let html = await fetchUrl(START_URL);
        let $ = cheerio.load(html);

        let href = findLink($, TARGET_DISTRICT);
        let nextUrl = new URL(href, BASE_URL).toString();

        html = await fetchUrl(nextUrl);
        $ = cheerio.load(html);

        href = findLink($, TARGET_BLOCK);
        if (!href) return console.log('Block not found');

        nextUrl = new URL(href, BASE_URL).toString();
        html = await fetchUrl(nextUrl);
        $ = cheerio.load(html);

        console.log(`\n--- Panchayats in ${TARGET_BLOCK} ---`);
        const panchayats = [];
        $('table a').each((i, el) => {
            const t = $(el).text().trim();
            if (t && isNaN(parseInt(t)) && t !== 'Back') {
                console.log(`- ${t}`);
                panchayats.push(t);
            }
        });

    } catch (e) {
        console.error("Error:", e);
    }
}

run();
