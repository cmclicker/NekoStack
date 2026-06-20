# `nest-controller-response-type`

Flags NestJS controller route handler methods decorated with an HTTP decorator (`@Get`, `@Post`, `@Put`, `@Delete`, `@Patch`, `@Head`, `@Options`, `@All`) that lack an explicit return type annotation.

## Why

Without a return type, a controller handler's response shape is implicit — TypeScript infers it from the implementation, but nothing connects it to the API contract. A refactor that changes the return value silently changes the API surface. Explicit return types make the contract visible, allow TypeScript to catch mismatches between the handler and its DTO, and serve as machine-readable documentation.

Active only in `*.controller.*` files.

## Examples

### Incorrect

```ts
@Controller('users')
export class UserController {
  @Get(':id')
  findOne(@Param('id') id: string) {   // no return type — flagged
    return this.users.findById(id);
  }
}
```

### Correct

```ts
@Controller('users')
export class UserController {
  @Get(':id')
  findOne(@Param('id') id: string): Promise<UserDto> {
    return this.users.findById(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.users.delete(id);
  }
}
```

## Options

None.

## When to disable

For streaming endpoints where the return type is `StreamableFile` or a Node.js `Readable` and TypeScript's type doesn't capture the full contract. Use an inline disable with a comment.
