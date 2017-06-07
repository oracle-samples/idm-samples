## Self-Service Collection

## Requirements

1. Check the [README.md](README.md) file.
2. Edit the ``Client Application`` to allow ``resource_owner`` requests.
3. Edit the ``{{USER_ID}}`` and ``{{USER_PW}}`` with credentials for the user that you want to perform self-service tasks.

## Set Up

1. Launch **Postman**, and then click **Import**.
2. Click **Import from Link**.
3. Paste the [Self Collection URL](idcs_self_postman_collection.json).

## Important Notes
- Use the **Get access_token (resource owner)** provided with the collection to obtain the access token.

> This request obtains an access token for the user ``{{USER_ID}}`` tat you set in the environment variables.

- After creating the access token, set the ``{{access_token}}`` global variable for future use in the APIs.

> The API requests pass the ``{{access_token}}`` via the authorization header: ```Authorization=Bearer <ACCESS_TOKEN>```

## License

The Oracle Identity Cloud Service REST Client samples are released under the UPL License. Visit [LICENSE.md](LICENSE.md) to know more.