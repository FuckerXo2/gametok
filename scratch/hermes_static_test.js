
class Foo {
  static {
    Foo.prototype.bar = true;
  }
}
print(new Foo().bar);
