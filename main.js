
    /*===================================
    *   MANHEIM
    *   COLCHESTER COMMERCIALS
    *
    * ====================================*/

    const qs                    = require("../../QS.js");

    // process.chdir(process.argv[2])
    if (!process.argv[2]) {
        const fileName=__filename.split(".js")[0].split('/')
        process.argv[5]=fileName[fileName.length-2]
    }


    let itemLinks               =           [];
    let is_end                  =           false;

    let browser;
    let page;

    var baseURL                 =           "https://www.manheim.co.uk";
    var loginURL                =           "https://www.manheim.co.uk/";
    var userName                =           "support@gaukmedia.com";
    var password                =           "GAUKMotors1234!";
    var location                =           "Colchester";
    var resultsURL              =           "https://www.manheim.co.uk/search?AuctionCentre%5B0%5D=" + location + "&IsKm=False";


    (async () =>
    {
        qs.log("--");
        qs.log("Starting spider run...");

        qs.scrapeDataLog.reset();

        [browser, page]         =           await qs.getPuppeteer();

        //View Port
        await page.setViewport({ width: 1920, height: 3000 });

        await page.setDefaultNavigationTimeout(18000); //set timeout to 3 min

        //Login - check for Errors
        await page.goto(loginURL, {waitUntil: 'load', timeout: 0});
        try
        {
            //Login Function called
            await login(page);
            qs.log("Login successful");

        }catch (e)
        {

            //console.log(e +" ===Login Error===");
        }


        //Page with Listing - Colchester
        await page.goto(resultsURL, {
                                        waitUntil: "domcontentloaded"
                                    });


        //Vat checker - Wait For filters to be visible completely
        try
        {
            await page.waitForSelector(".sidebar.sidebar_left.sidebar-closed");
            await page.waitForSelector(".refinements.js-refine-filters");
            await page.waitForSelector("div[data-facet-field='VATQualifing']");
            await page.waitForTimeout(2000);
            await page.click("div[data-facet-field='VATQualifing']");

            //console.log("VAT CLICKED");

        }catch (e)
        {
            //console.log(e + "==--VAT ERROR--==");
            qs.log(e +" -- ERROR - Node or Element for VAT Filter Not Found");
        }


        //Load the 'Commercial' Filter and Click it
        try
        {
            await page.waitForSelector(".ri__content.js-dropdown-content");
            await page.waitForSelector(".viewport");
            await page.waitForTimeout(2000);
            await page
                .waitForSelector("div[data-label='Commercial']", {visible: true})
                .then( page.click("div[data-label='Commercial']"));

            await page.waitForTimeout(2000);
            await page.waitForSelector(".listing.listing_logged");
            await page.waitForSelector(".listing__item.car");

            //console.log("COMMERCIAL CLICKED");

        }catch (e)
        {
            //console.log(e + "==--COMMERCIAL ERROR --==");
            qs.log(e +" -- ERROR - Node or Element for Commercial Filter Not Found");
            return;
        }

        //return;


        while(!is_end){

            let pageLinks       =       await queryAllHref('a.car__title');
            itemLinks           =       itemLinks.concat(pageLinks);
            //console.log(itemLinks);

            qs.log(pageLinks.length + ' car items scraped : Total ' + itemLinks.length + ' cars');

            let next_link       =       await getNextPageLink(page);

            if (!next_link){
                is_end          =       true;
                qs.log("All links scrapped");
                //console.log("LINK IF");
            }
            else
            {
                await page.goto(baseURL + next_link, {
                    waitUntil: 'networkidle0',
                });

                //console.log("LINE ELSE");
            }
        }

        const catalogueURLs = new Map(); //map associating catalogueURL with auction date of each catalogue
        for (let x = 0; x < itemLinks.length; x++) {
            await scrapeInformation(itemLinks[x], catalogueURLs);
        }

        qs.log("Spider run completed.");
        qs.scrapeDataLog.finalize();
        await qs.scrapeDataLog.sendResults(browser, page);


    })();

    async function login(page){
        await page.waitForSelector('.master-login-button.js-login-form-open');
        await page.click('.master-login-button.js-login-form-open');
        await page.waitForSelector('#loginForm\\.Email');
        await page.type('#loginForm\\.Email', userName);
        await page.type('#loginForm\\.Password', password);
        // click and wait for navigation
        await Promise.all([
            page.click('input[type="submit"], [value="Login]"'),
            page.waitForNavigation({ waitUntil: 'networkidle0'}),
        ]);
    };

    const queryAllHref = async function (sel) {
        return page.evaluate((sel) => {
            let elements = Array.from(document.querySelectorAll(sel));
            return elements.map(element => {
                return element.href.trim();
            });
        }, sel);
    };

    const getNextPageLink = async function () {
        return page.evaluate(() => {
            let link = document.querySelector('a[class="pages__item pages__item_next"]');
            if(link)
                return link.getAttribute('href');
            else
                return link;
        });
    };



    /**
     * Get Car Item information
     */
    const scrapeInformation = async function (url, catalogues) {
        let lotDetails = {};
        try {
            qs.log(url)


            const response = await page.goto(url, {
                waitUntil: 'networkidle0',
            });

            if (response.status() === 200) {
                qs.log('scrapping page:' + url);
                lotDetails = await page.evaluate((catalogues) => {
                    let lot = {};

                    lot["name"] = $("h1.vehicle-details__title").text().trim();

                    let properties = $("div.vehicle-details__properties").text().trim().split('-');
                    if (properties.length === 4){
                        lot["fuel"] = properties[1].trim();
                        lot["gearbox"] = properties[0].trim();
                    } else {
                        lot["fuel"] = properties[0].trim();
                    }

                    lot["manufacturer"] = window.location.href.split('/')[4].replace('%20',' ');
                    lot["model"] = window.location.href.split('/')[5].split('?')[0];

                    let catalogueURLElement = document.querySelector('div.attending__item span.attending__text.tooltip__container a');
                    if (catalogueURLElement !== null ){
                        let catalogueURL = catalogueURLElement.href;
                        if (catalogueURL in catalogues){
                            lot['auction_date'] = catalogues[catalogueURL];
                        }
                    } else
                        lot['auction_date'] = null;

                    let imageList = document.querySelectorAll('.flexslider.flexslider__vehicle .slides li a');
                    if(imageList.length !== 0){ //check if there is actually any image
                        lot["images"] = Array.from(imageList)
                            .map((e) => e.getAttribute('imagehigh'))
                            .filter(e => e)
                            .join(', ');
                    }

                    var details = {};

                    var elemLabel = document.querySelectorAll('div[class="vehicle-details__block vdb"] .vdb__item .vdb__label');
                    var elemValue = document.querySelectorAll('div[class="vehicle-details__block vdb"] .vdb__item .vdb__value');
                    for (var indx = 0; indx < elemLabel.length; indx++) {
                        var header = elemLabel[indx].innerText.trim();
                        details[header] = elemValue[indx].innerText.trim();
                    }

                    if (details["MFR YEAR"]) {
                        lot["year"] = details["MFR YEAR"];
                    }
                    if (details["COLOUR"]) {
                        lot["colour"] = details["COLOUR"];
                    }
                    if (details["NO OF SEATS"]) {
                        lot["seats"] = details["NO OF SEATS"];
                    }
                    if (details["REG NO"]) {
                        lot["registration"] = details["REG NO"];
                    }
                    //TODO check if odometer should save anything else
                    if (details["ODOMETER"]) {
                        lot["mileage"] = details["ODOMETER"].split(' ')[0];
                    }

                    return lot;
                }, catalogues);

                if(lotDetails['auction_date'] === undefined)
                    lotDetails['auction_date'] = await getAuctionDate(page, catalogues);

            } else {
                lotDetails = {}
            }
            lotDetails = {
                source: {
                    url: url,
                    date: new Date().toUTCString(),
                    status: response.status()
                },
                data: lotDetails
            };

            if (lotDetails["data"]["auction_date"] !== null){
                if(lotDetails["data"]['images'] !== undefined){
                    qs.scrapeDataLog.saveData(lotDetails);
                } else {
                    //console.log(`Images are coming undefined in lotdetails......`)
                    //console.log(`url : ${url}`)
                    qs.log(`Images are coming undefined in lotdetails......`)
                    qs.log(`url : ${url}`)
                }
            } else {
                //console.log(`auction_date is coming null.....`)
                //console.log(`url : ${url}`)
                qs.log(`auction_date is coming null.....`)
                qs.log(`url : ${url}`)
            }

        } catch (e) {
            qs.log('Skipped url because timeout or removed url...');
            qs.log(e)
        }
    };

    async function getAuctionDate(page, catalogues){
        let catalogueURL = await page.evaluate(() =>{
            return document.querySelector('div.attending__item span.attending__text.tooltip__container a').href;
        });

        await page.goto(catalogueURL);

        let months = {
            "Jan": "01",
            "Feb": "02",
            "Mar": "03",
            "Apr": "04",
            "May": "05",
            "Jun": "06",
            "June": "06",
            "Jul": "07",
            "July": "07",
            "Aug": "08",
            "Sep": "09",
            "Oct": "10",
            "Nov": "11",
            "Dec": "12"
        }

        await page.waitForSelector('.ed__date__item');
        let today = new Date();
        let day = await page.$eval('.ed__date__item .date', e => e.textContent.slice(0, 2));
        let month = await page.$eval('.ed__date__item .month', e => e.textContent);
        month = months[month];
        let year = (today.getMonth() === 11 && month === "01") ? today.getFullYear() + 1 : today.getFullYear(); //checks if the scraping is being done in december and the auction is going to be in january to determine the year
        let time = await page.$eval('.ed__date__item .time', e => e.textContent);

        let final_date = `${year}-${month}-${day} ${time}:00`;

        catalogues[catalogueURL] = final_date;

        return final_date;
    }


    async function autoScroll(page){
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                var totalHeight = 0;
                var distance = 100;
                var timer = setInterval(() => {
                    var scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if(totalHeight >= scrollHeight - window.innerHeight){
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
    }