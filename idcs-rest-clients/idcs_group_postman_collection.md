## Group Collection

## Requirements

1. Check the [README.md](README.md) file.

## Setup

1. Launch **Postman** abd click **Import**.
2. Click **Import from Link**.
3. Paste the [Group Collection URL](idcs_group_postman_collection.json).

## Make requests

To learn how to make requests check the [Testing Oracle Identity Cloud Service REST APIs with Postman](http://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:13484) tutorial.

## Important Notes

- The requests are non-repeatable, unless you delete the users and groups previously created in previous calls.
- After creating an group, set the ``{{groupid}}`` global variable for future usen in the APIs.
- For adding and removing members, you will need to set the ``{{userid}}`` global variables. To do that, import the User collection and associate a ``{{userid}}`` like documented in the [Testing IDCS REST APIs with Postman](http://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:13484) tutorial.

## License

The Oracle Identity Cloud Service REST Client samples are released under the UPL License. Visit [LICENSE.md](LICENSE.md) to know more.