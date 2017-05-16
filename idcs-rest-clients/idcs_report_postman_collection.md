## Report Collection

## Requirements

1. Check the [README.md](README.md) file.

## Setup

1. Launch **Postman** abd click **Import**.
2. Click **Import from Link**.
3. Paste the [Report Collection URL](idcs_report_postman_collection.json).

## Make requests

To learn how to make requests check the [Testing Oracle Identity Cloud Service REST APIs with Postman](http://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:13484) tutorial.

## Important Notes

- The requests are non-repeatable, unless you delete the users and groups previously created in previous calls.
- For downloading reports in a format different from ``JSON`` (``PDF`` or ``CSV``):

> 1. Make the report request, and set the ``{{filename}}`` global variable with the file returned on the response.
> 2. Make the **Download Report/Diagnostic files** request to download the report file.

## License

The Oracle Identity Cloud Service REST Client samples are released under the UPL License. Visit [LICENSE.md](LICENSE.md) to know more.