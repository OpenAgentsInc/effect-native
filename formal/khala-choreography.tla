-------------------------- MODULE khala_choreography --------------------------
EXTENDS Naturals, FiniteSets, Sequences

CONSTANTS Nodes, None

States == {"exited", "entering", "entered", "exiting"}
Stable == {"exited", "entered"}

VARIABLES state, activeSwitch, scheduled
vars == <<state, activeSwitch, scheduled>>

Init ==
  /\ state = [node \in Nodes |-> "exited"]
  /\ activeSwitch = None
  /\ scheduled = {}

Enter(node) ==
  /\ node \in Nodes
  /\ state' = [state EXCEPT ![node] = "entering"]
  /\ scheduled' = scheduled \cup {node}
  /\ UNCHANGED activeSwitch

EnterEnd(node) ==
  /\ node \in scheduled
  /\ state' = [state EXCEPT ![node] = "entered"]
  /\ scheduled' = scheduled \ {node}
  /\ UNCHANGED activeSwitch

Exit(node) ==
  /\ node \in Nodes
  /\ state' = [state EXCEPT ![node] = "exiting"]
  /\ scheduled' = scheduled \cup {node}
  /\ UNCHANGED activeSwitch

ExitEnd(node) ==
  /\ node \in scheduled
  /\ state' = [state EXCEPT ![node] = "exited"]
  /\ scheduled' = scheduled \ {node}
  /\ activeSwitch' = IF activeSwitch = node THEN None ELSE activeSwitch

Switch(node) ==
  /\ node \in Nodes
  /\ state' = [candidate \in Nodes |-> IF candidate = node THEN "entering" ELSE "exiting"]
  /\ activeSwitch' = node
  /\ scheduled' = Nodes

Dispose ==
  /\ state' = [node \in Nodes |-> IF state[node] \in {"entered", "entering"} THEN "entered" ELSE "exited"]
  /\ activeSwitch' = None
  /\ scheduled' = {}

Next ==
  \/ \E node \in Nodes : Enter(node)
  \/ \E node \in Nodes : EnterEnd(node)
  \/ \E node \in Nodes : Exit(node)
  \/ \E node \in Nodes : ExitEnd(node)
  \/ \E node \in Nodes : Switch(node)
  \/ Dispose

TypeInvariant ==
  /\ state \in [Nodes -> States]
  /\ activeSwitch \in Nodes \cup {None}
  /\ scheduled \subseteq Nodes

SwitchExclusive == Cardinality({node \in Nodes : state[node] = "entered"}) <= 1
DisposedHasNoWork == scheduled = {} => \A node \in Nodes : state[node] \in Stable

=============================================================================
