## Self-Service Collection

## Requirements

1. Check the [README.md](README.md) file.
2. Edit the ``Clien Application`` to allow ``resource_owner`` requests.
3. Edit the ``{{USER_ID}}`` and ``{{USER_PW}}`` with credentials for the user you want to perform self-service tasks.

## Setup

1. Launch **Postman** abd click **Import**.
2. Click **Import from Link**.
3. Paste the [Self Collection URL](idcs_self_postman_collection.json).

## Important Notes
- For obtaining the access token, use the **Get access_token (resource owner)** provided with the collection. 

> This request obtains an access token for the user ``{{USER_ID}}`` set on the environment variables.

- After creating the access token, set the ``{{access_token}}`` global variable for future usen in the APIs.

> The API Requests will pass the ``{{access_token}}`` via authorization header:
```Authorization=Bearer <ACCESS_TOKEN>```

## License

The IDCS REST Client samples are released under the UPL License. Visit [LICENSE.md](LICENSE.md) to know more.