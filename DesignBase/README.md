# OurFinance — seven-page visual prototype

Run `npm install` and `npm start` from this directory, then open `http://127.0.0.1:4301/`.

The two page layouts live in `src/app/layouts`: one for authenticated pages and one for login and invitation. Each of the seven folders in `src/app/pages` contains a parent page component and its visual child components. The authenticated layout owns the navigation, header, banner slot and content slot. At 1487 × 1058 px, all five authenticated banners occupy the same 1205 × 247 px area at the same position.

Each desktop page can display its approved reference at 50% opacity using the comparison controls. The `_resize` references share a 1487 × 1058 px canvas. Financial figures are sample data; saving and account workflows require application integration.
