import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "./auth";
import { Loading } from "./components/ui";
import { AccountDetailScreen } from "./screens/AccountDetailScreen";
import { AccountsScreen } from "./screens/AccountsScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { LogVisitScreen } from "./screens/LogVisitScreen";
import { PipelineScreen } from "./screens/PipelineScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TodayScreen } from "./screens/TodayScreen";

export type RootStackParamList = {
  Login: undefined;
  Tabs: undefined;
  AccountDetail: { accountId: string; name: string };
  LogVisit: { visitId: string; accountId: string; accountName: string };
};

export type TabParamList = {
  Today: undefined;
  Accounts: undefined;
  Pipeline: undefined;
  Settings: undefined;
};

export type RootScreenProps<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ tabBarIconStyle: { display: "none" }, tabBarLabelStyle: { fontSize: 14 } }}>
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Accounts" component={AccountsScreen} />
      <Tab.Screen name="Pipeline" component={PipelineScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { state } = useAuth();
  if (state.status === "loading") return <Loading />;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {state.status === "signedOut" ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen
              name="AccountDetail"
              component={AccountDetailScreen}
              options={({ route }) => ({ title: route.params.name })}
            />
            <Stack.Screen
              name="LogVisit"
              component={LogVisitScreen}
              options={{ title: "Log visit", presentation: "modal" }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
