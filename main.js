
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
    var userName                =           "someusername";
    var password                =           "somepassword";
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
        
        //LOGIN FUNCTION DISABLED IN SAMPLE FILE
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
     * THESE FUNCTIONS ARE DISABLED IN SAMPLE FILE
     */
    
   
