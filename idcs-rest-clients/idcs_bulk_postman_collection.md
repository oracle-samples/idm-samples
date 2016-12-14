## Bulk Collection

## Requirements

1. Check the [README.md](README.md) file.

## Setup

1. Launch **Postman** abd click **Import**.
2. Click **Import from Link**.
3. Paste the [Bulk Collection URL](idcs_bulk_postman_collection.json).

## Make requests

To learn how to make requests check the [Testing IDCS REST APIs with Postman](http://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:13484) tutorial.

## Important Notes

- The requests are non-repeatable, unless you delete the users and groups previously created in previous calls.
- For linking entries, use the ``{{userid}}``, ``{{userid2}}``, ``{{groupid}}``, ``{{groupid2}}``, ``{{appid}}``, and ``{{appid2}}`` global variables.

## License

The IDCS REST Client samples are released under the UPL License. Visit [LICENSE.md](LICENSE.md) to know more.