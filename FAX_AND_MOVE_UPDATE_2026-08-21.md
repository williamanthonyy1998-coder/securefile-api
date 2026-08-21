# Fax + Move update

- Files page has Move File and Move Folder actions.
- Folder moves validate destination permissions and prevent moving a folder into itself/descendants.
- Fax Documents now supports selecting a stored SecureFile document and sending it to an E.164 fax number.
- Fax history records outbound and inbound activity.
- Inbound fax is routed by each company's provider-assigned fax number, saved into Files, and notifies the Company Admin.
- Phaxio configuration is documented in docs/FAX_SETUP.md.
- Company Settings includes a Company fax number field.
- User/storage upgrades from Settings create a pending upgrade and do not change active limits until Stripe payment confirmation.
