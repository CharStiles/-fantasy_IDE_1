import { useState } from "react";
import { type Node } from "@shared/schema";
import { Card } from "@/components/ui/card";

interface NodeGraphProps {
  nodes: Node[];
  onNodeSelect: (node: Node) => void;
}

export function NodeGraph({ nodes, onNodeSelect }: NodeGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  const handleNodeClick = (node: Node) => {
    setSelectedNodeId(node.id);
    onNodeSelect(node);
  };

  const getNodeTypeColor = (type: string) => {
    switch (type) {
      case 'webgl':
        return 'bg-blue-600';
      case 'javascript':
        return 'bg-green-600';
      case 'ai':
        return 'bg-purple-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <Card className="w-full h-full bg-gray-900 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white text-xl font-bold">Node Graph</h2>
        <div className="text-sm text-gray-400">
          {nodes.length} node{nodes.length !== 1 ? 's' : ''}
        </div>
      </div>
      
      <div className="h-full overflow-auto">
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">📊</div>
              <p>No nodes created yet</p>
              <p className="text-sm mt-1">Create your first node to get started</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {nodes.map((node) => (
              <div
                key={node.id}
                onClick={() => handleNodeClick(node)}
                className={`
                  p-4 rounded-lg border-2 cursor-pointer transition-all duration-200
                  ${selectedNodeId === node.id 
                    ? 'border-blue-400 bg-gray-800' 
                    : 'border-gray-600 bg-gray-800 hover:border-gray-500 hover:bg-gray-750'
                  }
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getNodeTypeColor(node.type)}`}></div>
                    <span className="text-white font-medium">
                      {node.type.charAt(0).toUpperCase() + node.type.slice(1)} Node
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">#{node.id}</span>
                </div>
                
                <div className="text-sm text-gray-300 mb-2">
                  {node.code ? (
                    <div className="font-mono text-xs bg-gray-700 p-2 rounded overflow-hidden">
                      {node.code.length > 100 
                        ? `${node.code.substring(0, 100)}...` 
                        : node.code
                      }
                    </div>
                  ) : (
                    <span className="text-gray-500 italic">No code</span>
                  )}
                </div>
                
                {node.position && (
                  <div className="text-xs text-gray-400">
                    Position: ({node.position.x}, {node.position.y})
                  </div>
                )}
                
                {node.connections && node.connections.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    {node.connections.length} connection{node.connections.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

