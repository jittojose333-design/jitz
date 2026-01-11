const cheerio = require('cheerio');
const https = require('https');

const BASE_URL = 'https://nregastrep.nic.in/netnrega/';
const START_URL = 'https://nregastrep.nic.in/netnrega/materialwise_exp.aspx?lflag=eng&flg=v&state_code=16&state_name=KERALA&page=s&fin_year=2025-2026&Digest=iGHV9dpfm0nO4UVhdORvSQ';
const TARGET_PANCHAYAT = 'MARANGATTUPILLY';

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

async function run() {
    console.log('Navigating to Uzhavoor Block...');
    // Hardcoded path to Uzhavoor based on previous successful logs
    // KOTTAYAM -> UZHAVOOR

    // 1. Get Landing
    let html = await fetchUrl(START_URL);
    let $ = cheerio.load(html);

    // 2. Get Kottayam
    let href = $('a:contains("KOTTAYAM")').attr('href');
    if (!href) return console.log('Kottayam not found');
    html = await fetchUrl(new URL(href, BASE_URL).toString());
    $ = cheerio.load(html);

    // 3. Get Uzhavoor
    href = $('a:contains("Uzhavoor")').attr('href');
    if (!href) return console.log('Uzhavoor not found');
    html = await fetchUrl(new URL(href, BASE_URL).toString());
    $ = cheerio.load(html);

    // 4. Scan numeric links
    const numericLinks = [];
    $('a').each((i, el) => {
        const t = $(el).text().trim();
        const h = $(el).attr('href');
        if (t && !isNaN(parseInt(t)) && h) {
            numericLinks.push({ text: t, href: h });
        }
    });

    console.log(`Scanning ${numericLinks.length} panchayats inside Uzhavoor...`);

    for (const link of numericLinks) {
        process.stdout.write(`Checking ID ${link.text}... `);
        const pUrl = new URL(link.href, BASE_URL).toString();
        const pHtml = await fetchUrl(pUrl);

        // Check if page content contains "Marangattupilly"
        if (pHtml.toLowerCase().includes('marangattupilly') || pHtml.toLowerCase().includes('marangattupilly')) {
            console.log('MATCH FOUND!');
            console.log(`Panchayat is listed as ID: "${link.text}"`);
            return;
        } else {
            console.log('No');
        }
        await new Promise(r => setTimeout(r, 200));
    }
    console.log('Not found in any numeric link.');
}

run();
