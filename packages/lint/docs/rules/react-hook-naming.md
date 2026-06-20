# `react-hook-naming`

Flags named functions that call React hooks but are not named with the `use` prefix or as a PascalCase component.

## Why

React's rules of hooks require that hooks are called only from custom hooks or components. The `use` prefix and PascalCase naming conventions exist precisely so that React (and `eslint-plugin-react-hooks`) can statically verify these call sites. A helper named `getData` that calls `useState` internally looks like a plain function to every analyser — it will be called from loops, conditionals, or plain JS contexts without any warning, causing hard-to-diagnose hook-order bugs.

Hook calls inside anonymous callbacks are attributed to the innermost named frame — so `setup(() => { useState(0) })` doesn't flag `setup`.

Test files are fully exempt.

## Examples

### Incorrect

```ts
// Looks like a utility — React will not enforce hook rules here
function loadUserData() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { fetchUser().then(setUser); }, []);
  return user;
}
```

### Correct

```ts
// Custom hook — use prefix signals the constraint
function useUserData() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { fetchUser().then(setUser); }, []);
  return user;
}

// PascalCase component — also allowed
function UserCard() {
  const user = useUserData();
  return <div>{user?.name}</div>;
}
```

## Options

None.

## When to disable

In test helpers that intentionally call hooks in a test context (e.g. `renderHook` wrappers). The rule is already disabled in test files automatically.
