
# How to Modify the Sample Sign-In Application

This sample sign-in application is based on Codepen # [Login/Registration Form Transition](https://codepen.io/suez/pen/RpNXOR). It contains HTML, CSS and JavaScript files that governs the look-and-feel of the page.

## Basic layout changes

### Change Background and Logo Images 

The sample sign-in application contains some images used as background and logo in the sign-in page.
These files are located Under the public/images folder of the application.
- `background.png` is used as the background image of the slider.
- `logo.png` is the logo that appears in the slider space of the screen.

You can replace these files.

### Change font size and colors

The sample sign-in application is based on Cascade Style Sheet (CSS).
You can change the font size and colors by changing the CSS files located under the public/css folder of the application.

## Add more support languages

The sample sign-in application is localized to support multiple languages such as:

- English
- Brazilian Portuguese
- Spanish
- German
- Italian
- Danish
- Hindi
- Norwegian

The text content presented in the screen rely on the browsers language configuration. Access your web browser options language configuration and place the desired language before the other ones.

To add other languages to the support list execute the following procedure:

1. Under the public/resources folder of the application, create a file and name it as the language locale prefix.
For example, for japanese create the file name `ja.js`.
See [List of ISO 639-1 codes](]https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes).

2. Copy and paste the content of the `en.js` file into the newly created language file.

3. Translate all the properties avaiable in the language file, and then save the file.

Next time you call Oracle Identity Cloud Service and the custom sign-in page appears, it will handle the new language.