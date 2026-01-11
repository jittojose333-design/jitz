const cheerio = require('cheerio');
const https = require('https');

const BASE_URL = 'https://nregastrep.nic.in/netnrega/';
const START_URL = 'https://nregastrep.nic.in/netnrega/materialwise_exp.aspx?lflag=eng&flg=v&state_code=16&state_name=KERALA&page=s&fin_year=2025-2026&Digest=iGHV9dpfm0nO4UVhdORvSQ';

const TARGET_DISTRICT = 'KOTTAYAM';
const TARGET_PANCHAYAT = 'MARANGATTUPILLY';

// Cookie jar
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

function getBlockLinks($doc) {
    const blocks = [];
    $doc('table a').each((i, el) => {
        const text = $doc(el).text().trim();
        const href = $doc(el).attr('href');
        // Heuristic: Blocks usually don't clearly identify themselves, but let's grab all table links 
        // that are NOT numeric and look like names.
        if (text && isNaN(parseInt(text)) && text !== 'Back' && href) {
            blocks.push({ text, href });
        }
    });
    return blocks;
}

async function run() {
    try {
        console.log(`1. Fetching Start URL...`);
        let html = await fetchUrl(START_URL);
        let $ = cheerio.load(html);

        console.log(`2. Looking for District: ${TARGET_DISTRICT}`);
        let href = findLink($, TARGET_DISTRICT);
        if (!href) return console.error('District not found');

        let nextUrl = new URL(href, BASE_URL).toString();
        html = await fetchUrl(nextUrl);
        $ = cheerio.load(html);

        console.log(`3. Scanning ALL Blocks in ${TARGET_DISTRICT} for ${TARGET_PANCHAYAT}...`);
        const blocks = getBlockLinks($);
        console.log(`Found ${blocks.length} potential blocks.`);

        for (const block of blocks) {
            process.stdout.write(`Checking Block: ${block.text}... `);
            const blockUrl = new URL(block.href, BASE_URL).toString();
            const blockHtml = await fetchUrl(blockUrl);
            const $block = cheerio.load(blockHtml);

            const gpLink = findLink($block, TARGET_PANCHAYAT);
            if (gpLink) {
                console.log(`FOUND!`);
                console.log(`\nSUCCESS! 'Marangattupilly' is in Block: '${block.text}'`);
                console.log('Update your settings to use this Block name.');
                return;
            } else {
                console.log('No');
            }
            // Add a small delay to avoid 429
            await new Promise(r => setTimeout(r, 200));
        }

        console.log('\nSearch complete. Panchayat not found in any block.');

    } catch (e) {
        console.error("Error:", e);
    }
}

run();
