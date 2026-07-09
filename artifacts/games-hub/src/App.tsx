import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import Home from '@/pages/Home';
import RockPaperScissors from '@/pages/RockPaperScissors';
import GuessTheNumber from '@/pages/GuessTheNumber';
import HandCricket from '@/pages/HandCricket';
import MultiplayerCricket from '@/pages/MultiplayerCricket';
import TeamCricket from '@/pages/TeamCricket';
import Login from '@/pages/Login';
import Stats from '@/pages/Stats';
import SideGames from '@/pages/SideGames';
import { AuthProvider } from '@/lib/authContext';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/cricket" component={HandCricket} />
      <Route path="/multiplayer" component={MultiplayerCricket} />
      <Route path="/team" component={TeamCricket} />
      <Route path="/stats" component={Stats} />
      <Route path="/side-games" component={SideGames} />
      <Route path="/rps" component={RockPaperScissors} />
      <Route path="/guess" component={GuessTheNumber} />
      <Route path="/login" component={Login} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;