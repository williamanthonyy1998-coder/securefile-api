# SecureFile — Plan + Business Intelligence Update

## Fixed plans

- **Starter:** 1 user, 5 GB, File Side-panel Preview + User File Rename.
- **Business:** 5 users, 100 GB, Preview + Scanner + File/Folder Re-sharing + User File Rename.
- **Professional:** 10 users, 250 GB, all six add-ons enabled.
- **Custom:** users, storage, months and add-ons selected by the customer.

Pricing remains:
- First user: $10/user/month
- Each additional user: $5/user/month
- Storage: $0.30/GB/month
- Preview: $5/user/month
- Scanner: $5/user/month
- Fax: $5/user/month
- File/folder re-sharing: $1/user/month
- User file rename: $2/user/month
- Post-office mailing: $10/user/month

## Business information

Customer signup now requires:
- Business / Industry
- Business Description (optional)

The values are stored on `Company` and are visible to Super Admin.

## Super Admin intelligence

The Companies screen now shows:
- Business / Industry
- Selected Plan (`STARTER`, `BUSINESS`, `PROFESSIONAL`, `CUSTOM`)
- Subscription price and duration
- Users and storage
- Subscription status

Super Admin can search and filter companies by plan and industry. A customer-intelligence section summarizes how many companies use each plan and which industries are represented.

## Plan enforcement

For fixed plans, the backend ignores manipulated users/storage/add-on values from the browser and applies the official plan definition. Custom plans use the customer's selected configuration.

## Database update

This release adds nullable `Company.businessIndustry` and `Company.businessDescription` fields. Existing companies remain valid and display `Other` when no industry was recorded.

After replacing the project:

```cmd
npm run db:generate
npm run db:push
npm run dev
```
