# c4c exec Command Examples

This file demonstrates various ways to use the `c4c exec` command to execute procedures and workflows.

## Executing Procedures

### Basic Execution

```bash
# Create a user
c4c exec procedure users.create \
  --input '{"name":"Alice","email":"alice@example.com","role":"admin"}'

# Or use the short alias "proc"
c4c exec proc users.create \
  -i '{"name":"Bob","email":"bob@example.com","role":"user"}'
```

### List Users

```bash
c4c exec proc users.list
```

### Get Specific User

```bash
# First create a user and note the ID
c4c exec proc users.create -i '{"name":"Test User","email":"test@example.com"}'

# Then get that user (replace USER_ID with actual ID)
c4c exec proc users.get -i '{"id":"USER_ID"}'
```

### Update User

```bash
c4c exec proc users.update \
  -i '{"id":"USER_ID","name":"Updated Name","role":"moderator"}'
```

### Product Operations

```bash
# List all products
c4c exec proc products.list

# Filter products by category and price
c4c exec proc products.list \
  -i '{"category":"electronics","minPrice":50,"maxPrice":500}'

# Create a new product
c4c exec proc products.create \
  -i '{"name":"Monitor","description":"4K Display","price":399.99,"stock":10,"category":"electronics"}'

# Update product stock
c4c exec proc products.updateStock \
  -i '{"id":"PRODUCT_ID","quantity":-5}'
```

### Analytics

```bash
# Get system statistics
c4c exec proc analytics.stats

# Health check
c4c exec proc analytics.health

# Get JSON output only (no logs)
c4c exec proc analytics.stats --json
```

## Using Input Files

Create a file `user-input.json`:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "role": "admin"
}
```

Execute with input file:
```bash
c4c exec proc users.create --input-file user-input.json
# Or short form
c4c exec proc users.create -f user-input.json
```

## Executing Workflows

### Basic Workflow Execution

The `workflows/test-workflow.ts` workflow creates a user, creates a product, and gets analytics.

Create a file `workflow-input.json`:
```json
{
  "name": "Alice Workshop",
  "email": "alice@example.com",
  "role": "moderator",
  "description": "New Product from Workflow",
  "price": 299.99,
  "stock": 20,
  "category": "electronics"
}
```

Execute the workflow:
```bash
# Using input file
c4c exec workflow workflows/test-workflow.ts -f workflow-input.json

# Using short alias
c4c exec wf workflows/test-workflow.ts -f workflow-input.json

# With inline JSON
c4c exec wf workflows/test-workflow.ts \
  -i '{"name":"Quick","email":"quick@test.com","role":"user","description":"Quick product","price":99.99,"stock":5,"category":"electronics"}'
```

### JSON Output Mode

Get only JSON output (useful for scripting):

```bash
# Procedure
c4c exec proc analytics.stats --json | jq '.products.totalValue'

# Workflow
c4c exec wf workflows/test-workflow.ts -f workflow-input.json --json | jq '.status'
```

## Chaining Commands

```bash
# Create user and save output
USER_OUTPUT=$(c4c exec proc users.create -i '{"name":"Test","email":"test@example.com"}' --json)

# Extract user ID
USER_ID=$(echo $USER_OUTPUT | jq -r '.id')

# Get the user
c4c exec proc users.get -i "{\"id\":\"$USER_ID\"}"
```

## Error Handling

The `exec` command will exit with code 1 on errors:

```bash
# Try to create user with invalid email
c4c exec proc users.create -i '{"name":"Test","email":"invalid","role":"user"}'
# Returns: Error: Invalid email format

# Try to get non-existent user
c4c exec proc users.get -i '{"id":"nonexistent"}'
# Returns: Error: User not found: nonexistent

# Try to create user with invalid role
c4c exec proc users.create -i '{"name":"Test","email":"test@example.com","role":"invalid"}'
# Returns: Error: Invalid role. Must be one of: admin, user, moderator, guest
```

## All Available Procedures

```bash
# Users
c4c exec proc users.create -i '{...}'
c4c exec proc users.get -i '{...}'
c4c exec proc users.list
c4c exec proc users.update -i '{...}'
c4c exec proc users.delete -i '{...}'

# Products
c4c exec proc products.create -i '{...}'
c4c exec proc products.get -i '{...}'
c4c exec proc products.list -i '{...}'
c4c exec proc products.updateStock -i '{...}'

# Analytics
c4c exec proc analytics.stats
c4c exec proc analytics.health
```

## Tips

1. **Use `--json` flag** for scripting and piping to other commands
2. **Use `-f` / `--input-file`** for complex inputs or reusable test data
3. **Use short aliases** (`proc` for `procedure`, `wf` for `workflow`) to save typing
4. **Check exit codes** in scripts: `$?` will be 0 on success, 1 on error
5. **Combine with jq** for JSON processing: `c4c exec proc analytics.stats --json | jq '.users.total'`

## Integration with Scripts

Example bash script:

```bash
#!/bin/bash

# Create test user
echo "Creating test user..."
USER_JSON=$(c4c exec proc users.create \
  -i '{"name":"Test User","email":"test@example.com","role":"user"}' \
  --json)

if [ $? -ne 0 ]; then
  echo "Failed to create user"
  exit 1
fi

USER_ID=$(echo $USER_JSON | jq -r '.id')
echo "Created user with ID: $USER_ID"

# Create test product
echo "Creating test product..."
PRODUCT_JSON=$(c4c exec proc products.create \
  -i '{"name":"Test Product","description":"For testing","price":9.99,"stock":100,"category":"test"}' \
  --json)

if [ $? -ne 0 ]; then
  echo "Failed to create product"
  exit 1
fi

PRODUCT_ID=$(echo $PRODUCT_JSON | jq -r '.id')
echo "Created product with ID: $PRODUCT_ID"

# Get analytics
echo "Getting analytics..."
c4c exec proc analytics.stats

echo "Done!"
```
