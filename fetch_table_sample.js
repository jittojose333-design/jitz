const cheerio = require('cheerio');
const https = require('https');

const BASE_URL = 'https://nregastrep.nic.in/netnrega/';
const START_URL = 'https://nregastrep.nic.in/netnrega/materialwise_exp.aspx?lflag=eng&flg=v&state_code=16&state_name=KERALA&page=s&fin_year=2025-2026&Digest=iGHV9dpfm0nO4UVhdORvSQ';

// We know Marangattupilly is ID 15 in Uzhavoor (1610009)
// But we need to navigate there dynamically to get cookies right.

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
    try {
        // 1. Start
        let html = await fetchUrl(START_URL);
        let $ = cheerio.load(html);

        // 2. Kottayam
        let href = $('a:contains("KOTTAYAM")').attr('href');
        html = await fetchUrl(new URL(href, BASE_URL).toString());
        $ = cheerio.load(html);

        // 3. Uzhavoor
        href = $('a:contains("Uzhavoor")').attr('href');
        html = await fetchUrl(new URL(href, BASE_URL).toString());
        $ = cheerio.load(html);

        // 4. Marangattupilly (ID 15)
        // We look for the link with text "15"
        let link15 = $('a').filter((i, el) => $(el).text().trim() === '15');
        href = link15.attr('href');

        if (!href) return console.log('Link 15 not found');

        console.log('Navigating to Marangattupilly (ID 15)...');
        html = await fetchUrl(new URL(href, BASE_URL).toString());
        $ = cheerio.load(html);

        console.log('\n--- EXTRACTED ROWS (First 10) ---');
        let count = 0;
        $('tr').each((i, el) => {
            const cells = $(el).find('td');
            if (cells.length > 3) { // Skip header-ish rows
                const rowText = cells.map((j, c) => $(c).text().replace(/\s+/g, ' ').trim()).get().join('\t');
                if (count < 10) console.log(rowText);
                count++;
            }
        });
        console.log(`\nTotal Data Rows: ${count}`);

    } catch (e) {
        console.error(e);
    }
}

run();
