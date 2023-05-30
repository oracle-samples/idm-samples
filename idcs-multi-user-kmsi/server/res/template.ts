type renderOptions = {
  body: string;
  title: string;
  initialState: string;
  cssLocation: string;
  jsLocation: string;
  redwood: boolean;
}

function renderHTML(opts:renderOptions):string {
  return `
      <!DOCTYPE html>
      <html>
        <style>
          @import url('https://fonts.googleapis.com/css?family=Roboto&display=swap');
        </style>
        <link
          rel="stylesheet"
          href="${opts.cssLocation}"
        />
        <head>
          <script>window.__APP_INITIAL_STATE__ = ${opts.initialState}; window.__REDWOOD_THEME__ = ${opts.redwood}</script>
          <title>${opts.title}</title>
        </head>
        <body>
          <div id="root">${opts.body}</div>
          <script defer="defer" src="${opts.jsLocation}"></script>
        </body>
      </html>
    `;
};

export default renderHTML;