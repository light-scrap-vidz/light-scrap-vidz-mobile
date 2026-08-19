// Use the in-memory AsyncStorage mock so config get/set can be tested without
// a native module.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// `@expo/vector-icons` pulls in the native font loader, which jest-expo does not
// stub; render the icon name as plain text instead so queries stay readable.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const icon = (family) => (props) =>
    React.createElement(Text, { ...props, testID: props.testID ?? `icon-${family}-${props.name}` });
  return new Proxy({}, { get: (_t, family) => icon(String(family)) });
});

// SafeAreaProvider withholds its children until it has layout metrics, which never
// arrive in jest; the library ships a mock that supplies fixed insets.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// TouchableOpacity anime son opacité sur 150 ms, pilotées sous jest par des
// timers. L'animation survit à la fin du test qui a déclenché la pression et met
// alors l'état à jour hors de act() — une exécution sur une douzaine échouait au
// hasard. Sous test, un simple Pressable suffit : le retour visuel ne se vérifie
// pas ici, et rien ne reste en vol après la pression.
jest.mock('react-native/Libraries/Components/Touchable/TouchableOpacity', () => {
  const React = require('react');
  const { Pressable } = require('react-native');
  const Mock = React.forwardRef((props, ref) =>
    React.createElement(Pressable, { ...props, ref }),
  );
  Mock.displayName = 'TouchableOpacity';
  return Mock;
});
