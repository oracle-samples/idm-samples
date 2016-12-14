## OAuth Collection

## Requirements

1. Check the [README.md](README.md) file.
2. Edit the ``Clien Application`` to allow ``resource_owner``, and ``assertion`` requests.
3. Edit the ``{{USER_ID}}`` and ``{{USER_PW}}`` with credentials for the user you want to perform self-service tasks.

## Setup

1. Launch **Postman** abd click **Import**.
2. Click **Import from Link**.
3. Paste the [OAuth Collection URL](idcs_oauth_postman_collection.json).

## Important Notes
- Use the requests under the folder **Tokens - Get (authorize)** to obtain access_tokens.
- After creating the access token, set the ``{{access_token}}`` global variable for future usen in the APIs.

> The API Requests will pass the ``{{access_token}}`` via authorization header:
```Authorization=Bearer <ACCESS_TOKEN>```

## License

The IDCS REST Client samples are released under the UPL License. Visit [LICENSE.md](LICENSE.md) to know more.